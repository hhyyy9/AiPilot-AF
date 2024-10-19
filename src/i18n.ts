import i18n from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";
import path from "path";

// 初始化 i18next
i18n
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: "en",
    preload: ["en", "zh"], // 预加载的语言
    backend: {
      loadPath: path.join(__dirname, "locales/{{lng}}/{{ns}}.json"),
    },
    detection: {
      // 语言检测选项
      order: ["header", "querystring", "cookie"],
      caches: ["cookie"],
    },
    ns: ["translation"],
    defaultNS: "translation",
  });

export default i18n;
