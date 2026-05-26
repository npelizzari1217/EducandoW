module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'esbuild' || pkg.name === '@esbuild/linux-x64') {
        pkg.scripts = { ...pkg.scripts, postinstall: 'exit 0' };
      }
      return pkg;
    },
  },
};
