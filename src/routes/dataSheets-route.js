const express = require("express");
const dataSheetsRouter = express.Router();
const dataSheetsController = require("../controllers/dataSheets-controller");

dataSheetsRouter.get("/get-all-data/:id", dataSheetsController.getAllDataByID);
dataSheetsRouter.get(
  "/check-file-type/:id",
  dataSheetsController.checkFileType
);

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

// new google sheets routes
dataSheetsRouter.post(
  "/create-sheet-with-table",
  dataSheetsController.createSheetWithTableData
);
dataSheetsRouter.post(
  "/export-data-to-existing-sheet",
  dataSheetsController.exportDataToExistingSheet
);

module.exports = dataSheetsRouter;
