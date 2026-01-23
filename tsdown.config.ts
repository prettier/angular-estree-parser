import { defineConfig } from 'tsdown';

export default defineConfig({
  external: ['@babel/types'],
  fixedExtension: false,
  dts: true,
});
