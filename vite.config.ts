import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    // 生成 sourcemap 以便于调试
    sourcemap: false,
    // 确保输出目录适用于 Chrome 扩展
    outDir: "dist",
    // 输出资源的路径处理方式
    assetsDir: "assets",
    // 禁用代码分割，每个入口点都完整包含自己的依赖
    rollupOptions: {
      input: {
        // 定义多入口文件
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
    // 禁用压缩以方便调试
    minify: false,
  },
  // 在设置路径别名，比如可以用 '@/' 表示 src 目录
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
