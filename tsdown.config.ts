import { defineConfig } from 'tsdown';

export default defineConfig({
  deps: {
    neverBundle: ['@babel/types'],
  },
  fixedExtension: false,
  dts: true,
});
