module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "extends": [
        "prettier"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": "./tsconfig.json",
        "sourceType": "module"
    },
    "plugins": [
        "jsdoc",
        "@typescript-eslint",
    ],
    "root": true,
    overrides: [
        {
            files:
                [
                    'lib/**/*.ts',
                    'examples/**/*.ts',
                    'test/**/*.ts',
                ],
            extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
            "rules": {
                "jsdoc/check-alignment": "error",
                "jsdoc/check-indentation": "error",
              "@typescript-eslint/no-duplicate-enum-values": "warn",
              "@typescript-eslint/no-explicit-any": "warn",
              "@typescript-eslint/no-unused-vars": "off",
              "@typescript-eslint/no-unsafe-declaration-merging": "warn"
            },
        }
    ],
    "ignorePatterns": [
        "test/**",
        "tsconfig.json",
        "dist/**"
    ]
}
