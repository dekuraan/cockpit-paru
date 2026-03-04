# Maintainer: Gideon Wolfe
# Run: makepkg -si   (from the repo root)
pkgname=cockpit-paru
pkgver=0.1.0
pkgrel=1
pkgdesc='Cockpit plugin for Arch Linux package management with AUR support'
arch=('x86_64')
url='https://github.com/gideonwolfe/cockpit-paru'
license=('GPL-3.0-or-later')
depends=('cockpit' 'pacman' 'paru')
makedepends=('npm' 'rust' 'cargo')
# source=("$pkgname-$pkgver.tar.gz::https://github.com/gideonwolfe/$pkgname/archive/v$pkgver.tar.gz")
# sha256sums=('')
# For local builds, run makepkg -si from the repo root
source=()
sha256sums=()

build() {
    cd "$startdir"
    make build
}

package() {
    cd "$startdir"
    make DESTDIR="$pkgdir" PREFIX=/usr install
}
