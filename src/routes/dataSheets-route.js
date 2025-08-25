const express = require("express");
const dataSheetsRouter = express.Router();
const dataSheetsController = require("../controllers/dataSheets-controller");

dataSheetsRouter.get("/get-all-data/:id", dataSheetsController.getAllDataByID);

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
