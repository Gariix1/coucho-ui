import globals from 'globals';

export default [{
  files:['js/**/*.js','tests/**/*.mjs'],
  languageOptions:{
    ecmaVersion:'latest',
    sourceType:'module',
    globals:{...globals.browser,...globals.node}
  },
  rules:{
    'no-undef':'error',
    'no-redeclare':'error',
    'no-duplicate-imports':'error',
    'no-unreachable':'error'
  }
}];
