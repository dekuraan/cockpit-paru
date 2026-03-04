use alpm::Alpm;
use anyhow::{Context, Result};
use serde::Deserialize;

use crate::models::AurPackage;

/// Get all foreign (AUR/manually installed) packages — packages in localdb not in any syncdb.
pub fn get_foreign_packages(handle: &Alpm) -> Vec<(String, String)> {
    let localdb = handle.localdb();
    let syncdbs = handle.syncdbs();

    localdb
        .pkgs()
        .iter()
        .filter(|pkg| {
            !syncdbs
                .iter()
                .any(|db| db.pkg(pkg.name()).is_ok())
        })
        .map(|pkg| (pkg.name().to_string(), pkg.version().to_string()))
        .collect()
}

/// Raw AUR RPC response structures
#[derive(Deserialize)]
pub struct AurRpcResponse {
    #[serde(rename = "resultcount")]
    pub result_count: usize,
    pub results: Vec<AurRpcPackage>,
    #[serde(rename = "type")]
    pub response_type: String,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct AurRpcPackage {
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Version")]
    pub version: String,
    #[serde(rename = "Description")]
    pub description: Option<String>,
    #[serde(rename = "PackageBase")]
    pub package_base: Option<String>,
    #[serde(rename = "Maintainer")]
    pub maintainer: Option<String>,
    #[serde(rename = "NumVotes")]
    pub num_votes: Option<i64>,
    #[serde(rename = "Popularity")]
    pub popularity: Option<f64>,
    #[serde(rename = "FirstSubmitted")]
    pub first_submitted: Option<i64>,
    #[serde(rename = "LastModified")]
    pub last_modified: Option<i64>,
    #[serde(rename = "OutOfDate")]
    pub out_of_date: Option<i64>,
    #[serde(rename = "URL")]
    pub url: Option<String>,
    #[serde(rename = "Depends", default)]
    pub depends: Vec<String>,
    #[serde(rename = "MakeDepends", default)]
    pub makedepends: Vec<String>,
}

impl AurRpcPackage {
    pub fn into_aur_package(self, installed: bool, installed_version: Option<String>) -> AurPackage {
        AurPackage {
            name: self.name,
            version: self.version,
            description: self.description,
            package_base: self.package_base,
            maintainer: self.maintainer,
            votes: self.num_votes.unwrap_or(0),
            popularity: self.popularity.unwrap_or(0.0),
            first_submitted: self.first_submitted,
            last_modified: self.last_modified,
            out_of_date: self.out_of_date,
            url: self.url,
            depends: self.depends,
            makedepends: self.makedepends,
            installed,
            installed_version,
        }
    }
}

const AUR_RPC_BASE: &str = "https://aur.archlinux.org/rpc/v5";

/// Query the AUR RPC API for search results.
pub fn query_aur_search(query: &str) -> Result<AurRpcResponse> {
    let url = format!("{}/search/{}", AUR_RPC_BASE, query);
    let body = ureq::get(&url)
        .call()
        .context("Failed to query AUR RPC API")?
        .into_body()
        .read_to_string()
        .context("Failed to read AUR RPC response body")?;
    let response: AurRpcResponse =
        serde_json::from_str(&body).context("Failed to parse AUR RPC response")?;

    if let Some(ref error) = response.error {
        anyhow::bail!("AUR RPC error: {}", error);
    }

    Ok(response)
}

/// Query the AUR RPC API for package info (one or more packages).
pub fn query_aur_info(names: &[&str]) -> Result<AurRpcResponse> {
    if names.is_empty() {
        return Ok(AurRpcResponse {
            result_count: 0,
            results: Vec::new(),
            response_type: "multiinfo".to_string(),
            error: None,
        });
    }

    // Build URL with query params: /info?arg[]=pkg1&arg[]=pkg2
    let mut url = format!("{}/info", AUR_RPC_BASE);
    for (i, name) in names.iter().enumerate() {
        if i == 0 {
            url.push_str(&format!("?arg[]={}", name));
        } else {
            url.push_str(&format!("&arg[]={}", name));
        }
    }

    let body = ureq::get(&url)
        .call()
        .context("Failed to query AUR RPC API")?
        .into_body()
        .read_to_string()
        .context("Failed to read AUR RPC response body")?;
    let response: AurRpcResponse =
        serde_json::from_str(&body).context("Failed to parse AUR RPC response")?;

    if let Some(ref error) = response.error {
        anyhow::bail!("AUR RPC error: {}", error);
    }

    Ok(response)
}
