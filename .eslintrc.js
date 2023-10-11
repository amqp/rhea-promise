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
            },
        }
    ],
    "ignorePatterns": [
        "test/**",
        "tsconfig.json",
        "dist/**",
        "dist-esm/**"
    ]
}
