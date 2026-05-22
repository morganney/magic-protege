import type { Config } from 'stylelint'

export default {
  extends: ['stylelint-config-standard', 'stylelint-config-css-modules'],
  rules: {
    // CSS Modules class names commonly mirror TS identifiers.
    //'selector-class-pattern': null,
  },
} satisfies Config
