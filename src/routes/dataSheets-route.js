const express = require("express");
const dataSheetsRouter = express.Router();
const dataSheetsController = require("../controllers/dataSheets-controller");

dataSheetsRouter.get("/overall-data", dataSheetsController.getOverallData);
dataSheetsRouter.get(
  "/overall-data/:id",
  dataSheetsController.getOverallDataById
);
dataSheetsRouter.get("/overall-budget", dataSheetsController.getOverallBudget);
dataSheetsRouter.get("/sem-data/:id", dataSheetsController.getSemDataById);
dataSheetsRouter.get(
  "/gg-demographic/:id",
  dataSheetsController.getGGDemographic
);
dataSheetsRouter.get("/gdn-data/:id", dataSheetsController.getGDNDataById);
dataSheetsRouter.get("/disc-data/:id", dataSheetsController.getDiscDataById);
dataSheetsRouter.get(
  "/youtube-data/:id",
  dataSheetsController.getYoutubeDataById
);
dataSheetsRouter.get(
  "/facebook-data/:id",
  dataSheetsController.getFacebookDataById
);
dataSheetsRouter.get(
  "/facebook-picture/:id",
  dataSheetsController.getFacebookPictureById
);
dataSheetsRouter.get(
  "/fb-demographic/:id",
  dataSheetsController.getFBDemographic
);
dataSheetsRouter.get(
  "/tiktok-data/:id",
  dataSheetsController.getTiktokDataById
);
dataSheetsRouter.get("/line-data/:id", dataSheetsController.getLineDataById);
dataSheetsRouter.get(
  "/taboola-data/:id",
  dataSheetsController.getTaboolaDataById
);
dataSheetsRouter.get("/media-plan/:id", dataSheetsController.getMediaPlanById);

// NEW: Google Slides routes
dataSheetsRouter.post(
  "/create-presentation",
  dataSheetsController.createPresentation
);
dataSheetsRouter.post(
  "/add-slide",
  dataSheetsController.addSlideToPresentation
);
dataSheetsRouter.post(
  "/create-multi-slide-presentation",
  dataSheetsController.createMultiSlidePresentation
);
dataSheetsRouter.get("/test-setup", dataSheetsController.testFullSetup);
dataSheetsRouter.get("/auth/url", dataSheetsController.getAuthUrl);
dataSheetsRouter.get("/auth/callback", dataSheetsController.authCallback);
dataSheetsRouter.get("/test-oauth2", dataSheetsController.testOAuth2Setup);
dataSheetsRouter.get("/debug-oauth-vars", dataSheetsController.debugOAuthVars);

module.exports = dataSheetsRouter;
