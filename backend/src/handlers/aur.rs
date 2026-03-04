use anyhow::{Context, Result};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::alpm::get_handle;
use crate::aur::{get_foreign_packages, query_aur_info, query_aur_search};
use crate::models::{
    AurSearchResponse, AurUpdateInfo, AurUpdatesResponse, PkgbuildResponse, StreamEvent,
};
use crate::util::{emit_event, emit_json, setup_signal_handler, is_cancelled};

/// Search the AUR for packages matching a query.
pub fn aur_search(
    query: &str,
    offset: usize,
    limit: usize,
    sort_by: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<()> {
    let rpc_response = query_aur_search(query)?;

    // Cross-check with localdb for install status
    let handle = get_handle()?;
    let localdb = handle.localdb();

    let mut results: Vec<_> = rpc_response
        .results
        .into_iter()
        .map(|pkg| {
            let (installed, installed_version) = match localdb.pkg(pkg.name.as_str()) {
                Ok(local_pkg) => (true, Some(local_pkg.version().to_string())),
                Err(_) => (false, None),
            };
            pkg.into_aur_package(installed, installed_version)
        })
        .collect();

    // Sort
    let ascending = sort_dir.map(|d| d != "desc").unwrap_or(true);
    match sort_by.unwrap_or("votes") {
        "name" => results.sort_by(|a, b| {
            let cmp = a.name.to_lowercase().cmp(&b.name.to_lowercase());
            if ascending { cmp } else { cmp.reverse() }
        }),
        "popularity" => results.sort_by(|a, b| {
            let cmp = a.popularity.partial_cmp(&b.popularity).unwrap_or(std::cmp::Ordering::Equal);
            if ascending { cmp } else { cmp.reverse() }
        }),
        _ => results.sort_by(|a, b| {
            let cmp = a.votes.cmp(&b.votes);
            if ascending { cmp } else { cmp.reverse() }
        }),
    }

    let total = results.len();

    // Paginate
    let paginated: Vec<_> = results.into_iter().skip(offset).take(limit).collect();

    emit_json(&AurSearchResponse {
        results: paginated,
        total,
    })
}

/// Get detailed info for a single AUR package.
pub fn aur_info(name: &str) -> Result<()> {
    let rpc_response = query_aur_info(&[name])?;

    let pkg = rpc_response
        .results
        .into_iter()
        .next()
        .ok_or_else(|| anyhow::anyhow!("Package '{}' not found in AUR", name))?;

    // Check install status
    let handle = get_handle()?;
    let localdb = handle.localdb();
    let (installed, installed_version) = match localdb.pkg(name) {
        Ok(local_pkg) => (true, Some(local_pkg.version().to_string())),
        Err(_) => (false, None),
    };

    let aur_pkg = pkg.into_aur_package(installed, installed_version);
    emit_json(&aur_pkg)
}

/// Check for updates to foreign (AUR) packages.
pub fn aur_check_updates() -> Result<()> {
    let handle = get_handle()?;
    let foreign = get_foreign_packages(&handle);

    if foreign.is_empty() {
        return emit_json(&AurUpdatesResponse {
            updates: Vec::new(),
            total: 0,
            warnings: vec!["No foreign packages installed".to_string()],
        });
    }

    // Query AUR for all foreign packages in batches
    let mut all_updates = Vec::new();
    let mut warnings = Vec::new();

    // AUR RPC allows up to ~200 args at a time
    for chunk in foreign.chunks(150) {
        let names: Vec<&str> = chunk.iter().map(|(n, _)| n.as_str()).collect();
        match query_aur_info(&names) {
            Ok(rpc_response) => {
                for aur_pkg in rpc_response.results {
                    // Find the local version
                    if let Some((_, local_version)) =
                        chunk.iter().find(|(n, _)| *n == aur_pkg.name)
                    {
                        // Compare versions using alpm
                        let local_ver = alpm::Version::new(local_version.as_str());
                        let aur_ver = alpm::Version::new(aur_pkg.version.as_str());
                        if aur_ver > local_ver {
                            all_updates.push(AurUpdateInfo {
                                name: aur_pkg.name,
                                current_version: local_version.clone(),
                                new_version: aur_pkg.version,
                                maintainer: aur_pkg.maintainer,
                                out_of_date: aur_pkg.out_of_date,
                            });
                        }
                    }
                }
            }
            Err(e) => {
                warnings.push(format!("Failed to query AUR for batch: {}", e));
            }
        }
    }

    let total = all_updates.len();
    emit_json(&AurUpdatesResponse {
        updates: all_updates,
        total,
        warnings,
    })
}

/// Get the PKGBUILD for an AUR package using paru -Gp.
pub fn aur_get_pkgbuild(name: &str) -> Result<()> {
    let output = Command::new("paru")
        .args(["-Gp", name])
        .output()
        .context("Failed to run paru -Gp")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("Failed to get PKGBUILD for '{}': {}", name, stderr.trim());
    }

    let pkgbuild = String::from_utf8_lossy(&output.stdout).to_string();
    emit_json(&PkgbuildResponse {
        name: name.to_string(),
        pkgbuild,
    })
}

/// Install an AUR package using paru -S --noconfirm, streaming output.
pub fn aur_install(name: &str, timeout: Option<u64>) -> Result<()> {
    setup_signal_handler();
    let timeout_secs = timeout.unwrap_or(600);

    emit_event(&StreamEvent::Log {
        level: "info".to_string(),
        message: format!("Installing AUR package: {}", name),
    });

    let mut child = Command::new("paru")
        .args(["-S", "--noconfirm", name])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn paru")?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Stream stdout
    let stdout_handle = std::thread::spawn(move || {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    emit_event(&StreamEvent::Log {
                        level: "info".to_string(),
                        message: line,
                    });
                }
            }
        }
    });

    // Stream stderr
    let stderr_handle = std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    emit_event(&StreamEvent::Log {
                        level: "warning".to_string(),
                        message: line,
                    });
                }
            }
        }
    });

    // Wait with timeout
    let start = std::time::Instant::now();
    let timeout_duration = std::time::Duration::from_secs(timeout_secs);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let _ = stdout_handle.join();
                let _ = stderr_handle.join();

                if status.success() {
                    emit_event(&StreamEvent::Complete {
                        success: true,
                        message: Some(format!("Successfully installed {}", name)),
                    });
                } else {
                    emit_event(&StreamEvent::Complete {
                        success: false,
                        message: Some(format!(
                            "paru exited with status {}",
                            status.code().unwrap_or(-1)
                        )),
                    });
                }
                return Ok(());
            }
            Ok(None) => {
                if is_cancelled() {
                    let _ = child.kill();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    emit_event(&StreamEvent::Complete {
                        success: false,
                        message: Some("Operation cancelled by user".to_string()),
                    });
                    return Ok(());
                }
                if start.elapsed() >= timeout_duration {
                    let _ = child.kill();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    emit_event(&StreamEvent::Complete {
                        success: false,
                        message: Some(format!(
                            "Operation timed out after {} seconds",
                            timeout_secs
                        )),
                    });
                    return Ok(());
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => {
                let _ = stdout_handle.join();
                let _ = stderr_handle.join();
                emit_event(&StreamEvent::Complete {
                    success: false,
                    message: Some(format!("Failed to wait for paru: {}", e)),
                });
                return Ok(());
            }
        }
    }
}

/// Upgrade all AUR packages using paru -Sua --noconfirm, streaming output.
pub fn aur_upgrade(timeout: Option<u64>) -> Result<()> {
    setup_signal_handler();
    let timeout_secs = timeout.unwrap_or(600);

    emit_event(&StreamEvent::Log {
        level: "info".to_string(),
        message: "Upgrading AUR packages...".to_string(),
    });

    let mut child = Command::new("paru")
        .args(["-Sua", "--noconfirm"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn paru")?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let stdout_handle = std::thread::spawn(move || {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    emit_event(&StreamEvent::Log {
                        level: "info".to_string(),
                        message: line,
                    });
                }
            }
        }
    });

    let stderr_handle = std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    emit_event(&StreamEvent::Log {
                        level: "warning".to_string(),
                        message: line,
                    });
                }
            }
        }
    });

    let start = std::time::Instant::now();
    let timeout_duration = std::time::Duration::from_secs(timeout_secs);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let _ = stdout_handle.join();
                let _ = stderr_handle.join();

                if status.success() {
                    emit_event(&StreamEvent::Complete {
                        success: true,
                        message: Some("AUR upgrade completed successfully".to_string()),
                    });
                } else {
                    emit_event(&StreamEvent::Complete {
                        success: false,
                        message: Some(format!(
                            "paru exited with status {}",
                            status.code().unwrap_or(-1)
                        )),
                    });
                }
                return Ok(());
            }
            Ok(None) => {
                if is_cancelled() {
                    let _ = child.kill();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    emit_event(&StreamEvent::Complete {
                        success: false,
                        message: Some("Operation cancelled by user".to_string()),
                    });
                    return Ok(());
                }
                if start.elapsed() >= timeout_duration {
                    let _ = child.kill();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    emit_event(&StreamEvent::Complete {
                        success: false,
                        message: Some(format!(
                            "Operation timed out after {} seconds",
                            timeout_secs
                        )),
                    });
                    return Ok(());
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(e) => {
                let _ = stdout_handle.join();
                let _ = stderr_handle.join();
                emit_event(&StreamEvent::Complete {
                    success: false,
                    message: Some(format!("Failed to wait for paru: {}", e)),
                });
                return Ok(());
            }
        }
    }
}
