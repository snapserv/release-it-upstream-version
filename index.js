const {Plugin} = require('release-it');
const fs = require('fs');
const semver = require('semver');

class UpstreamVersionPlugin extends Plugin {
  init() {
    this.versionFile = this.getContext('versionFile');
    this.versionPattern = this.getContext('versionPattern');
    this.defaultRevision = parseInt(this.getContext('defaultRevision') || 1);

    if (!this.versionFile) {
      throw new Error(`[upstream-version] Version file for extraction must be specified as 'versionFile'`);
    }
    if (!this.versionPattern) {
      throw new Error(`[upstream-version] Version pattern for extraction must be specified as 'versionPattern'`);
    }
  }

  getIncrementedVersion({latestVersion}) {
    return this.getIncrementedVersionCI({latestVersion});
  }

  getIncrementedVersionCI({latestVersion}) {
    // Prepare regular expression for version extraction
    const versionRegexp = new RegExp(this.versionPattern, 'gm');

    // Read contents of version file and search for pattern
    const contents = fs.readFileSync(this.versionFile);
    const matches = versionRegexp.exec(String(contents));
    if (!matches) {
      throw new Error(`[upstream-version] Could not find version pattern in source file [${this.versionFile}]: ${this.versionPattern}`);
    }
    if (!matches.groups || !matches.groups.version) {
      throw new Error(`[upstream-version] Could not find named capture group 'version' in pattern: ${this.versionPattern}`);
    }

    // Extract upstream version from named capture group
    const upstreamVersion = semver.coerce(matches.groups.version);
    this.log.info(`[upstream-version] Extracted upstream version from source file: ${upstreamVersion}`);

    // Ensure upstream version has no pre-release information
    const upstreamPrerelease = semver.prerelease(upstreamVersion);
    if (upstreamPrerelease) {
      throw new Error(`[upstream-version] Unable to use upstream version with pre-release specifier for versioning: ${upstreamVersion}`);
    }

    // Diff latest and upstream version and increment accordingly
    const versionDiff = semver.diff(latestVersion, upstreamVersion);
    const upstreamSemver = semver.parse(upstreamVersion);
    const incrementVersion = versionDiff === 'prerelease'
      ? semver.inc(latestVersion, 'prerelease')
      : semver.clean(`${upstreamSemver.major}.${upstreamSemver.minor}.${upstreamSemver.patch}-${this.defaultRevision}`);
    this.log.info(`[upstream-version] Determined increment version, bumping from ${latestVersion} to ${incrementVersion}`);

    // Return determined version for increment
    return incrementVersion;
  }
}

module.exports = UpstreamVersionPlugin;
