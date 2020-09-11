const {Plugin} = require('release-it');
const fs = require('fs');
const semver = require('semver');

const coerceSemVerRegExp = new RegExp(/(?<major>:0|[1-9]\d*)(?:\.(?<minor>:0|[1-9]\d*))?(?:\.(?<patch>:0|[1-9]\d*))?(?:-(?<prerelease>0|[1-9]\d*|\d*[a-zA-Z-][a-zA-Z0-9-]*))?/);

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
    // Sanitize latest version
    const latestSemver = this.sanitizeSemVer(latestVersion);
    this.log.info(`[upstream-version] Sanitized latest version [${latestVersion}] into [${latestSemver}]`);

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

    // Extract and sanitize upstream version from named capture group
    const upstreamVersion = matches.groups.version;
    this.log.info(`[upstream-version] Extracted upstream version from source file: ${upstreamVersion}`);
    const upstreamSemver = this.sanitizeSemVer(upstreamVersion);
    this.log.info(`[upstream-version] Sanitized upstream version [${upstreamVersion}] into [${upstreamSemver}]`);

    // Ensure upstream version has no pre-release information
    if (upstreamSemver.prerelease.length) {
      throw new Error(`[upstream-version] Unable to use upstream version with pre-release specifier for versioning: ${upstreamSemver}`);
    }

    // Diff latest and upstream version and increment accordingly
    const versionDiff = semver.diff(latestSemver, upstreamSemver);
    const incrementVersion = versionDiff === 'prerelease'
      ? semver.inc(latestSemver, 'prerelease')
      : semver.clean(`${upstreamSemver.major}.${upstreamSemver.minor}.${upstreamSemver.patch}-${this.defaultRevision}`);
    this.log.info(`[upstream-version] Determined increment version, bumping from ${latestSemver} to ${incrementVersion}`);

    // Return determined version for increment
    return incrementVersion;
  }

  sanitizeSemVer(raw) {
    // If version is already valid semver, return as parsed SemVer instance
    if (semver.valid(raw)) {
      return semver.parse(raw);
    }

    // Extract information using coercion regexp
    const match = coerceSemVerRegExp.exec(raw);
    if (!match) {
      throw new Error(`[upstream-version] Unable to coerce version into semver: ${raw}`);
    }

    // Coerce using builtin library function, then append prerelease if available
    const coerced = semver.coerce(raw);
    const result = match.groups.prerelease ? `${coerced}-${match.groups.prerelease}` : coerced;

    // Return as parsed SemVer instance
    return semver.parse(result);
  }
}

module.exports = UpstreamVersionPlugin;
