import json from 'rollup-plugin-json'

export default {
  input: 'token.js',
  output: {
    file: 'build/contract.js',
    format: 'cjs'
  },
  plugins: [ json() ]
}
