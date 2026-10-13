// Conventional Commits; release-please reads the type (feat, fix...) and
// BREAKING CHANGE to pick the next version.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Bodies are often bullet lists with long lines; only the header matters
    // for the changelog.
    'body-max-line-length': [0],
  },
};
