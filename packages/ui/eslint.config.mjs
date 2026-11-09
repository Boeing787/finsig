import config from '@finsig/eslint-config/next';

export default [
  ...config,
  {
    rules: {
      // TanStack Table intentionally returns mutable callback identities. React Compiler
      // skips this component; the table owns its own memoisation boundaries.
      'react-hooks/incompatible-library': 'off',
      // This is a library package, not a Next.js application with a pages directory.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
