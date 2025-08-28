const { google } = require("googleapis");
const createError = require("../utils/createError");
const { Readable } = require("stream");
const sharp = require("sharp");

const GOOGLE_SERVICE_ACCOUNT_KEY = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN,
};

// Keep your existing service account auth for Sheets/Drive
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT_KEY,
  scopes: [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const drive = google.drive({ version: "v3", auth });

// NEW: OAuth2 authentication for Slides API
const getOAuth2Clients = async () => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      "http://localhost:8000/data-sheets/auth/callback"
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
    });

    return {
      slides: google.slides({ version: "v1", auth: oauth2Client }),
      drive: google.drive({ version: "v3", auth: oauth2Client }),
      sheets: google.sheets({ version: "v4", auth: oauth2Client }), // ADD THIS LINE
    };
  } catch (error) {
    console.error("OAuth2 client creation failed:", error);
    throw error;
  }
};

const SHEET_ID = "1vSUFAzkbusSpMgiAeDxUKXh68Jkirh1IbeRlqruYs98";

const DEFAULT_SLIDES_FOLDER_ID = "1RDoydur_2jeMg9NcxOcXsV1zHySxyHGm";

// Helper function to convert buffer to readable stream
const bufferToStream = (buffer) => {
  const readable = new Readable({
    read() {},
  });
  readable.push(buffer);
  readable.push(null);
  return readable;
};

// Helper function to get image dimensions using Sharp
const getImageDimensions = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return { width: 1200, height: 800 }; // Fallback
  }
};

const calculateSlideDimensions = (imageWidth, imageHeight) => {
  const maxWidth = 960;
  const maxHeight = 540;

  const aspectRatio = imageWidth / imageHeight;

  let slideWidth, slideHeight;

  if (aspectRatio > maxWidth / maxHeight) {
    slideWidth = maxWidth;
    slideHeight = maxWidth / aspectRatio;
  } else {
    slideHeight = maxHeight;
    slideWidth = maxHeight * aspectRatio;
  }

  const centerX = (960 - slideWidth) / 2;
  const centerY = (540 - slideHeight) / 2;

  return {
    width: Math.round(slideWidth * 0.75),
    height: Math.round(slideHeight * 0.75),
    x: Math.round(centerX),
    y: Math.round(centerY),
  };
};

module.exports.checkFileType = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("=== FILE TYPE DIAGNOSTIC ===");
    console.log("File ID:", id);

    try {
      const fileInfo = await drive.files.get({
        fileId: id,
        fields:
          "id,name,mimeType,kind,createdTime,modifiedTime,webViewLink,parents",
      });

      const file = fileInfo.data;

      console.log("✅ File found!");
      console.log("📄 Name:", file.name);
      console.log("📋 MIME Type:", file.mimeType);
      console.log("🔗 Web View Link:", file.webViewLink);
      console.log("⏰ Created:", file.createdTime);
      console.log("📝 Modified:", file.modifiedTime);
      console.log("📁 Parents:", file.parents);

      // Check what type of Google file this is
      const fileTypes = {
        "application/vnd.google-apps.spreadsheet": "Google Sheets",
        "application/vnd.google-apps.document": "Google Docs",
        "application/vnd.google-apps.presentation": "Google Slides",
        "application/vnd.google-apps.form": "Google Forms",
        "application/vnd.google-apps.folder": "Google Drive Folder",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
          "Excel File (.xlsx)",
        "application/vnd.ms-excel": "Excel File (.xls)",
        "text/csv": "CSV File",
      };

      const fileType = fileTypes[file.mimeType] || `Unknown (${file.mimeType})`;
      const isGoogleSheets =
        file.mimeType === "application/vnd.google-apps.spreadsheet";

      console.log("📊 File Type:", fileType);
      console.log("✅ Is Google Sheets:", isGoogleSheets);

      // Generate the correct URL based on file type
      let correctUrl = file.webViewLink;
      if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
        correctUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
      } else if (file.mimeType === "application/vnd.google-apps.document") {
        correctUrl = `https://docs.google.com/document/d/${id}/edit`;
      } else if (file.mimeType === "application/vnd.google-apps.presentation") {
        correctUrl = `https://docs.google.com/presentation/d/${id}/edit`;
      }

      res.status(200).json({
        message: "File type diagnostic complete",
        fileInfo: {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          fileType: fileType,
          isGoogleSheets: isGoogleSheets,
          webViewLink: correctUrl,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
        },
        diagnosis: isGoogleSheets
          ? "✅ This IS a Google Sheets file - the Sheets API should work"
          : `❌ This is NOT a Google Sheets file (it's ${fileType}). You cannot use the Sheets API on this file.`,
        recommendation: isGoogleSheets
          ? "The file is correct - there might be a permissions or API issue"
          : "You need to either convert this file to Google Sheets format or use a different approach to read it",
        correctUrl: correctUrl,
      });
    } catch (driveError) {
      console.log("❌ Drive API error:", driveError.message);
      console.log("Error code:", driveError.code);

      let errorMessage = "Cannot access file via Drive API";
      if (driveError.code === 404) {
        errorMessage = "File not found - please check the file ID";
      } else if (driveError.code === 403) {
        errorMessage = "Access denied - check your service account permissions";
      }

      res.status(driveError.code || 500).json({
        message: errorMessage,
        error: driveError.message,
        fileId: id,
        suggestion:
          "Make sure the file ID is correct and your service account has access to it",
      });
    }
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    next(error);
  }
};

module.exports.getAllDataByID = async (req, res, next) => {
  try {
    const { id } = req.params;
    const SHEET_NAME = "all";
    const SHEET_RANGE = "A:Z";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${SHEET_NAME}!${SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "all data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.error("❌ Unexpected error:", error);
    next(error);
  }
};

// KEEP ALL YOUR EXISTING SHEET FUNCTIONS UNCHANGED
module.exports.getOverallData = async (req, res, next) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!${SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Overall data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getOverallBudget = async (req, res, next) => {
  try {
    const sheetName = "Budget";
    const range = "A:E";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${sheetName}!${range}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Overall Budget data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getMediaPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Media Plan Data:", id);
    const MEDIA_PLAN_SHEET_NAME = "MediaPlan";
    const MEDIA_PLAN_SHEET_RANGE = "A:Z";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${MEDIA_PLAN_SHEET_NAME}!${MEDIA_PLAN_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Media Plan data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getOverallDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching SpreadsheetID:", id);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${SHEET_NAME}!${SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Overall data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getSemDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching SEM Data:", id);
    const SEM_SHEET_NAME = "SEM Details";
    const SEM_SHEET_RANGE = "A:T";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${SEM_SHEET_NAME}!${SEM_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "SEM data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getGGDemographic = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching SEM Data:", id);
    const GG_DEMO_SHEET_NAME = "GG Demographic";
    const GG_DEMO_SHEET_RANGE = "A:U";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${GG_DEMO_SHEET_NAME}!${GG_DEMO_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "GG Demographic data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getGDNDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching GDN Data:", id);
    const GDN_SHEET_NAME = "GDN Details";
    const GDN_SHEET_RANGE = "A:T";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${GDN_SHEET_NAME}!${GDN_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "GDN data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getDiscDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Discovery Data:", id);
    const DISC_SHEET_NAME = "Disc Details";
    const DISC_SHEET_RANGE = "A:T";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${DISC_SHEET_NAME}!${DISC_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Discovery data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getYoutubeDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Youtube Data:", id);
    const YOUTUBE_SHEET_NAME = "YT Details";
    const YOUTUBE_SHEET_RANGE = "A:Z";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${YOUTUBE_SHEET_NAME}!${YOUTUBE_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Youtube data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getTiktokDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching TikTok Data:", id);
    const TIKTOK_SHEET_NAME = "TikTok Details";
    const TIKTOK_SHEET_RANGE = "A:T";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${TIKTOK_SHEET_NAME}!${TIKTOK_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "TikTok data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getLineDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Line Data:", id);
    const LINE_SHEET_NAME = "Line Details";
    const LINE_SHEET_RANGE = "A:ES";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${LINE_SHEET_NAME}!${LINE_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Line data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getTaboolaDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Taboola Data:", id);
    const TABOOLA_SHEET_NAME = "Taboola Daily";
    const TABOOLA_SHEET_RANGE = "A:T";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${TABOOLA_SHEET_NAME}!${TABOOLA_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Taboola data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getFacebookDataById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Facebook Data:", id);
    const FB_SHEET_NAME = "FB Details";
    // const FB_SHEET_NAME = "FB Details-New";
    const FB_SHEET_RANGE = "A:AG";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${FB_SHEET_NAME}!${FB_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Facebook data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getFacebookPictureById = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Facebook Picture:", id);
    const FB_SHEET_NAME = "FB Creative_TEST";
    // const FB_SHEET_NAME = "FB Details-New";
    const FB_SHEET_RANGE = "A:L";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${FB_SHEET_NAME}!${FB_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "Facebook picture fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

module.exports.getFBDemographic = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Fetching Facebook Demographic Data:", id);
    const GG_DEMO_SHEET_NAME = "FB Demographic";
    const GG_DEMO_SHEET_RANGE = "A:T";
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${GG_DEMO_SHEET_NAME}!${GG_DEMO_SHEET_RANGE}`,
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }
    res.status(200).json({
      message: "FB Demographic data fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// NEW: OAuth2 Setup Functions
module.exports.getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      "http://localhost:8000/data-sheets/auth/callback"
    );

    const scopes = [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });

    res.json({
      authUrl: url,
      message:
        "Visit this URL to authorize the application and get your refresh token",
      instructions:
        "1. Click the authUrl, 2. Sign in with your Google account, 3. Grant permissions, 4. You'll be redirected back with your refresh token",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.authCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "No authorization code received" });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      "http://localhost:8000/data-sheets/auth/callback"
    );

    const { tokens } = await oauth2Client.getToken(code);

    res.json({
      message: "✅ Authorization successful!",
      refresh_token: tokens.refresh_token,
      instructions:
        "Copy this refresh_token and add it to your .env file as GOOGLE_OAUTH_REFRESH_TOKEN=your-refresh-token",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// MODIFIED: Your createPresentation function now uses OAuth2 for Slides
module.exports.createPresentation = async (req, res, next) => {
  try {
    const {
      imageData,
      title = "Monthly Report",
      slideTitle = "Overall Performance",
    } = req.body;

    if (!imageData) {
      return res.status(400).json({
        error: "Image data is required",
      });
    }

    console.log("Creating presentation with OAuth2:", title);

    // Use OAuth2 clients for Slides and Drive operations
    const { slides: oauthSlides, drive: oauthDrive } = await getOAuth2Clients();

    // Create presentation
    const presentation = await oauthSlides.presentations.create({
      requestBody: { title },
    });

    const presentationId = presentation.data.presentationId;
    console.log("Presentation created with ID:", presentationId);

    // Move to folder (now works with OAuth2!)
    if (DEFAULT_SLIDES_FOLDER_ID) {
      try {
        const file = await oauthDrive.files.get({
          fileId: presentationId,
          fields: "parents",
        });

        const previousParents = file.data.parents
          ? file.data.parents.join(",")
          : "";

        await oauthDrive.files.update({
          fileId: presentationId,
          addParents: DEFAULT_SLIDES_FOLDER_ID,
          removeParents: previousParents,
          fields: "id, parents",
        });

        console.log("✅ Presentation moved to folder successfully");
      } catch (folderError) {
        console.error("Failed to move presentation to folder:", folderError);
      }
    }

    // Process image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const imageDimensions = await getImageDimensions(buffer);
    const slideDimensions = calculateSlideDimensions(
      imageDimensions.width,
      imageDimensions.height
    );

    console.log("Original image dimensions:", imageDimensions);
    console.log("Calculated slide dimensions:", slideDimensions);

    // Upload image to Drive (back to using folder!)
    const imageStream = bufferToStream(buffer);
    const driveResponse = await oauthDrive.files.create({
      requestBody: {
        name: `${slideTitle}_${Date.now()}.png`,
        parents: DEFAULT_SLIDES_FOLDER_ID ? [DEFAULT_SLIDES_FOLDER_ID] : [],
      },
      media: {
        mimeType: "image/png",
        body: imageStream,
      },
    });

    const imageFileId = driveResponse.data.id;
    console.log("Image uploaded with ID:", imageFileId);

    // Make file publicly viewable
    await oauthDrive.permissions.create({
      fileId: imageFileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Create slide with proper dimensions
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);

    const slideId = `slide_${timestamp}_${randomSuffix}`;
    const imageId = `image_${timestamp}_${randomSuffix}`;

    await oauthSlides.presentations.batchUpdate({
      presentationId: presentationId,
      requestBody: {
        requests: [
          {
            createSlide: {
              objectId: slideId,
              slideLayoutReference: {
                predefinedLayout: "BLANK",
              },
            },
          },
          {
            createImage: {
              objectId: imageId,
              url: `https://drive.google.com/uc?id=${imageFileId}`,
              elementProperties: {
                pageObjectId: slideId,
                size: {
                  width: { magnitude: slideDimensions.width, unit: "PT" },
                  height: { magnitude: slideDimensions.height, unit: "PT" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: slideDimensions.x,
                  translateY: slideDimensions.y,
                  unit: "PT",
                },
              },
            },
          },
        ],
      },
    });

    // Remove image file after create slide
    await oauthDrive.files.delete({
      fileId: imageFileId,
    });

    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

    console.log("Presentation created successfully:", presentationUrl);

    res.status(200).json({
      message: "✅ Presentation created successfully with OAuth2!",
      presentationUrl: presentationUrl,
      presentationId: presentationId,
      note: "Presentation created in your shared folder using OAuth2 authentication",
    });
  } catch (error) {
    console.error("Error creating presentation:", error);
    next(createError(500, `Failed to create presentation: ${error.message}`));
  }
};

// MODIFIED: addSlideToPresentation also uses OAuth2
module.exports.addSlideToPresentation = async (req, res, next) => {
  try {
    const { presentationId, imageData, slideTitle = "New Slide" } = req.body;

    if (!presentationId || !imageData) {
      return res.status(400).json({
        error: "Presentation ID and image data are required",
      });
    }

    console.log("Adding slide to presentation:", presentationId);

    // Use OAuth2 clients
    const { slides: oauthSlides, drive: oauthDrive } = await getOAuth2Clients();

    // Process image
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const imageDimensions = await getImageDimensions(buffer);
    const slideDimensions = calculateSlideDimensions(
      imageDimensions.width,
      imageDimensions.height
    );

    // Upload image to Drive
    const imageStream = bufferToStream(buffer);
    const driveResponse = await oauthDrive.files.create({
      requestBody: {
        name: `${slideTitle}_${Date.now()}.png`,
        parents: DEFAULT_SLIDES_FOLDER_ID ? [DEFAULT_SLIDES_FOLDER_ID] : [],
      },
      media: {
        mimeType: "image/png",
        body: imageStream,
      },
    });

    const imageFileId = driveResponse.data.id;

    // Make file publicly viewable
    await oauthDrive.permissions.create({
      fileId: imageFileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Create slide
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);

    const slideId = `slide_${timestamp}_${randomSuffix}`;
    const imageId = `image_${timestamp}_${randomSuffix}`;

    await oauthSlides.presentations.batchUpdate({
      presentationId: presentationId,
      requestBody: {
        requests: [
          {
            createSlide: {
              objectId: slideId,
              slideLayoutReference: {
                predefinedLayout: "BLANK",
              },
            },
          },
          {
            createImage: {
              objectId: imageId,
              url: `https://drive.google.com/uc?id=${imageFileId}`,
              elementProperties: {
                pageObjectId: slideId,
                size: {
                  width: { magnitude: slideDimensions.width, unit: "PT" },
                  height: { magnitude: slideDimensions.height, unit: "PT" },
                },
                transform: {
                  scaleX: 1,
                  scaleY: 1,
                  translateX: slideDimensions.x,
                  translateY: slideDimensions.y,
                  unit: "PT",
                },
              },
            },
          },
        ],
      },
    });

    // Remove image file after creating slide
    await oauthDrive.files.delete({
      fileId: imageFileId,
    });

    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

    res.status(200).json({
      message: "✅ Slide added successfully with OAuth2!",
      presentationUrl: presentationUrl,
      slideId: slideId,
    });
  } catch (error) {
    console.error("Error adding slide:", error);
    next(createError(500, `Failed to add slide: ${error.message}`));
  }
};

// NEW: Test OAuth2 setup
module.exports.testOAuth2Setup = async (req, res, next) => {
  try {
    console.log("🔍 Testing OAuth2 setup...");

    const { slides: oauthSlides, drive: oauthDrive } = await getOAuth2Clients();

    // Test Slides API
    console.log("Testing Slides API with OAuth2...");
    const testPresentation = await oauthSlides.presentations.create({
      requestBody: { title: "OAuth2 Test - Safe to Delete" },
    });
    console.log("✅ Slides API working with OAuth2!");

    // Test folder access
    console.log("Testing folder access...");
    const folderTest = await oauthDrive.files.get({
      fileId: DEFAULT_SLIDES_FOLDER_ID,
      fields: "id,name",
    });
    console.log("✅ Folder access working:", folderTest.data.name);

    // Clean up
    await oauthDrive.files.delete({
      fileId: testPresentation.data.presentationId,
    });

    res.status(200).json({
      success: true,
      message: "🎉 OAuth2 authentication working perfectly!",
      authMethod: "OAuth2 User Authentication",
      folderAccess: folderTest.data.name,
    });
  } catch (error) {
    console.error("OAuth2 test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      note: "Make sure you have set up OAuth2 credentials and refresh token",
    });
  }
};

// Keep your existing test function for reference
module.exports.testFullSetup = async (req, res, next) => {
  try {
    console.log("🔍 Testing complete Google setup...");
    console.log("Service Account:", GOOGLE_SERVICE_ACCOUNT_KEY.client_email);

    // 1. Test basic Drive access
    console.log("1️⃣ Testing Drive API access...");
    const driveTest = await drive.about.get({ fields: "user" });
    console.log("✅ Drive API working");

    // 2. Test OAuth2 setup
    console.log("2️⃣ Testing OAuth2 Slides API...");
    try {
      const { slides: oauthSlides, drive: oauthDrive } =
        await getOAuth2Clients();
      const testPresentation = await oauthSlides.presentations.create({
        requestBody: { title: "OAuth2 Test - Safe to Delete" },
      });
      console.log("✅ OAuth2 Slides API working!");

      await oauthDrive.files.delete({
        fileId: testPresentation.data.presentationId,
      });
      console.log("✅ OAuth2 test presentation cleaned up");
    } catch (oauthError) {
      console.log("❌ OAuth2 not set up yet:", oauthError.message);
    }

    res.status(200).json({
      success: true,
      message: "🎉 Google APIs setup complete!",
      serviceAccount: GOOGLE_SERVICE_ACCOUNT_KEY.client_email,
      note: "Service account works for Sheets/Drive, OAuth2 needed for Slides",
    });
  } catch (error) {
    console.error("❌ Setup test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      serviceAccount: GOOGLE_SERVICE_ACCOUNT_KEY.client_email,
    });
  }
};

module.exports.debugOAuthVars = async (req, res) => {
  res.json({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "MISSING",
    hasSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: "http://localhost:8000/auth/callback",
  });
};

module.exports.createMultiSlidePresentation = async (req, res, next) => {
  try {
    const { slides = [], presentationTitle = "Multi-Slide Report" } = req.body;

    if (!slides || slides.length === 0) {
      return res.status(400).json({
        error: "Slides array is required and must not be empty",
      });
    }

    console.log(
      `Creating presentation with ${slides.length} slides:`,
      presentationTitle
    );

    // Use OAuth2 clients
    const { slides: oauthSlides, drive: oauthDrive } = await getOAuth2Clients();

    // Create presentation
    const presentation = await oauthSlides.presentations.create({
      requestBody: { title: presentationTitle },
    });

    const presentationId = presentation.data.presentationId;
    console.log("Presentation created with ID:", presentationId);

    // Move to folder if specified
    if (DEFAULT_SLIDES_FOLDER_ID) {
      try {
        const file = await oauthDrive.files.get({
          fileId: presentationId,
          fields: "parents",
        });

        const previousParents = file.data.parents
          ? file.data.parents.join(",")
          : "";

        await oauthDrive.files.update({
          fileId: presentationId,
          addParents: DEFAULT_SLIDES_FOLDER_ID,
          removeParents: previousParents,
          fields: "id, parents",
        });

        console.log("✅ Presentation moved to folder successfully");
      } catch (folderError) {
        console.error("Failed to move presentation to folder:", folderError);
      }
    }

    // Process each slide
    const batchRequests = [];
    const tempImageIds = [];

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideIndex = i + 1;

      console.log(`Processing slide ${slideIndex}: ${slide.title}`);

      // Process image
      const base64Data = slide.imageData.replace(
        /^data:image\/\w+;base64,/,
        ""
      );
      const buffer = Buffer.from(base64Data, "base64");

      const imageDimensions = await getImageDimensions(buffer);
      const slideDimensions = calculateSlideDimensions(
        imageDimensions.width,
        imageDimensions.height
      );

      // Upload image to Drive
      const imageStream = bufferToStream(buffer);
      const driveResponse = await oauthDrive.files.create({
        requestBody: {
          name: `${slide.title}_${Date.now()}_${i}.png`,
          parents: DEFAULT_SLIDES_FOLDER_ID ? [DEFAULT_SLIDES_FOLDER_ID] : [],
        },
        media: {
          mimeType: "image/png",
          body: imageStream,
        },
      });

      const imageFileId = driveResponse.data.id;
      tempImageIds.push(imageFileId); // Keep track for cleanup

      console.log(
        `Image uploaded for slide ${slideIndex} with ID:`,
        imageFileId
      );

      // Make file publicly viewable
      await oauthDrive.permissions.create({
        fileId: imageFileId,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });

      // Generate unique IDs for this slide
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substr(2, 9);
      const slideId = `slide_${timestamp}_${i}_${randomSuffix}`;
      const imageId = `image_${timestamp}_${i}_${randomSuffix}`;

      // Add requests for this slide
      batchRequests.push(
        {
          createSlide: {
            objectId: slideId,
            slideLayoutReference: {
              predefinedLayout: "BLANK",
            },
          },
        },
        {
          createImage: {
            objectId: imageId,
            url: `https://drive.google.com/uc?id=${imageFileId}`,
            elementProperties: {
              pageObjectId: slideId,
              size: {
                width: { magnitude: slideDimensions.width, unit: "PT" },
                height: { magnitude: slideDimensions.height, unit: "PT" },
              },
              transform: {
                scaleX: 1,
                scaleY: 1,
                translateX: slideDimensions.x,
                translateY: slideDimensions.y,
                unit: "PT",
              },
            },
          },
        }
      );
    }

    // Execute all slide creation requests in batch
    console.log(
      `Executing batch update with ${batchRequests.length} requests...`
    );
    await oauthSlides.presentations.batchUpdate({
      presentationId: presentationId,
      requestBody: {
        requests: batchRequests,
      },
    });

    // Clean up temporary image files
    console.log("Cleaning up temporary image files...");
    for (const imageFileId of tempImageIds) {
      try {
        await oauthDrive.files.delete({
          fileId: imageFileId,
        });
      } catch (deleteError) {
        console.error(`Failed to delete image ${imageFileId}:`, deleteError);
      }
    }

    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;

    console.log(
      "Multi-slide presentation created successfully:",
      presentationUrl
    );

    res.status(200).json({
      message: `✅ Presentation created successfully with ${slides.length} slides!`,
      presentationUrl: presentationUrl,
      presentationId: presentationId,
      slidesCreated: slides.length,
      note: "Multi-slide presentation created in your shared folder using OAuth2 authentication",
    });
  } catch (error) {
    console.error("Error creating multi-slide presentation:", error);
    next(createError(500, `Failed to create presentation: ${error.message}`));
  }
};

// Export data to existing sheet - Modified to use OAuth2
module.exports.exportDataToExistingSheet = async (req, res, next) => {
  try {
    const {
      spreadsheetId,
      data,
      sheetName = "Sheet1",
      startCell = "A1",
      clearExisting = false,
    } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({
        error: "Spreadsheet ID is required",
      });
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        error: "Data array is required and must not be empty",
      });
    }

    console.log(
      `Exporting ${data.length} rows to existing sheet: ${spreadsheetId} using OAuth2`
    );

    // Use OAuth2 clients
    const { sheets: oauthSheets } = await getOAuth2Clients();

    // Clear existing data if requested
    if (clearExisting) {
      await oauthSheets.spreadsheets.values.clear({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A:ZZ`,
      });
      console.log("Existing data cleared");
    }

    // Prepare data for insertion
    const values = data.map((row) => {
      if (Array.isArray(row)) {
        return row;
      } else if (typeof row === "object") {
        return Object.values(row);
      } else {
        return [row];
      }
    });

    // Insert data in batches for large datasets
    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(values.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const startRow = i * BATCH_SIZE;
      const endRow = Math.min(startRow + BATCH_SIZE, values.length);
      const batchValues = values.slice(startRow, endRow);

      // Calculate the actual start cell for this batch
      const batchStartCell =
        startCell === "A1" ? `A${startRow + 1}` : startCell;

      console.log(
        `Inserting batch ${i + 1}/${totalBatches}: rows ${
          startRow + 1
        } to ${endRow}`
      );

      await oauthSheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!${batchStartCell}`,
        valueInputOption: "RAW",
        requestBody: {
          values: batchValues,
        },
      });

      // Small delay between batches to avoid rate limits
      if (i < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    res.status(200).json({
      message: "Data exported to existing sheet successfully",
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      rowsInserted: values.length,
      columnsInserted: values[0]?.length || 0,
      authMethod: "OAuth2",
      batchesProcessed: totalBatches,
    });
  } catch (error) {
    console.error("Error exporting data to existing sheet:", error);

    let errorMessage = `Failed to export data: ${error.message}`;
    if (error.code === 403) {
      errorMessage =
        "Permission denied. Please check your OAuth2 credentials and sheet permissions.";
    } else if (error.code === 401) {
      errorMessage = "Authentication failed. Please refresh your OAuth2 token.";
    } else if (error.code === 404) {
      errorMessage = "Spreadsheet not found. Please check the spreadsheet ID.";
    }

    next(createError(500, errorMessage));
  }
};

// Create sheet with table data - Modified to use OAuth2
module.exports.createSheetWithTableData = async (req, res, next) => {
  try {
    const {
      title = "Table Export",
      tableData,
      headers,
      sheetName = "Data",
      folderID = null,
    } = req.body;

    if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
      return res.status(400).json({
        error: "Table data is required and must not be empty",
      });
    }

    console.log(
      `Creating table sheet: ${title} with ${tableData.length} data rows using OAuth2`
    );

    // Use OAuth2 clients
    const { sheets: oauthSheets, drive: oauthDrive } = await getOAuth2Clients();

    // Prepare values array first to know the dimensions
    const values = [];

    // Add headers if provided, otherwise extract from first object
    if (headers && Array.isArray(headers)) {
      values.push(headers);
    } else if (tableData[0] && typeof tableData[0] === "object") {
      values.push(Object.keys(tableData[0]));
    }

    // Add data rows
    tableData.forEach((row) => {
      if (typeof row === "object" && !Array.isArray(row)) {
        // Convert object to array maintaining header order
        if (headers) {
          values.push(headers.map((header) => row[header] || ""));
        } else {
          values.push(Object.values(row));
        }
      } else if (Array.isArray(row)) {
        values.push(row);
      } else {
        values.push([row]);
      }
    });

    const totalRows = values.length;
    const totalColumns = values[0]?.length || 1;

    console.log(`Total rows needed: ${totalRows}, columns: ${totalColumns}`);

    // Calculate required sheet size with buffer
    const requiredRows = Math.max(totalRows + 100, 1000); // Add buffer rows
    const requiredColumns = Math.max(totalColumns + 5, 26); // Add buffer columns

    // Create new spreadsheet with proper dimensions
    const spreadsheet = await oauthSheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title,
        },
        sheets: [
          {
            properties: {
              title: sheetName,
              gridProperties: {
                rowCount: requiredRows,
                columnCount: requiredColumns,
              },
            },
          },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;
    console.log(`New spreadsheet created with ID: ${spreadsheetId}`);
    console.log(
      `Sheet dimensions: ${requiredRows} rows x ${requiredColumns} columns`
    );

    // Move to folder if specified
    if (folderID) {
      try {
        const file = await oauthDrive.files.get({
          fileId: spreadsheetId,
          fields: "parents",
        });

        const previousParents = file.data.parents
          ? file.data.parents.join(",")
          : "";

        await oauthDrive.files.update({
          fileId: spreadsheetId,
          addParents: folderID,
          removeParents: previousParents,
          fields: "id, parents",
        });

        console.log("Spreadsheet moved to folder successfully");
      } catch (folderError) {
        console.error("Failed to move to folder:", folderError);
      }
    }

    // Insert data in batches with proper error handling
    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(values.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const startRow = i * BATCH_SIZE;
      const endRow = Math.min(startRow + BATCH_SIZE, values.length);
      const batchValues = values.slice(startRow, endRow);

      // Use A1 notation properly - start from row 1 for first batch
      const batchStartCell = `A${startRow + 1}`;

      console.log(
        `Inserting batch ${i + 1}/${totalBatches}: rows ${
          startRow + 1
        } to ${endRow} (${batchValues.length} rows)`
      );

      try {
        await oauthSheets.spreadsheets.values.update({
          spreadsheetId: spreadsheetId,
          range: `${sheetName}!${batchStartCell}`,
          valueInputOption: "RAW",
          requestBody: {
            values: batchValues,
          },
        });

        console.log(`✅ Batch ${i + 1} inserted successfully`);

        // Small delay between batches to avoid rate limits
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (batchError) {
        console.error(`❌ Error in batch ${i + 1}:`, batchError.message);

        // If it's a grid limits error, try to expand the sheet
        if (batchError.message.includes("exceeds grid limits")) {
          console.log("Attempting to expand sheet dimensions...");

          try {
            // Expand the sheet to accommodate the data
            const newRowCount = Math.max(endRow + 100, requiredRows);

            await oauthSheets.spreadsheets.batchUpdate({
              spreadsheetId: spreadsheetId,
              requestBody: {
                requests: [
                  {
                    updateSheetProperties: {
                      properties: {
                        sheetId: 0, // Usually the first sheet
                        gridProperties: {
                          rowCount: newRowCount,
                          columnCount: requiredColumns,
                        },
                      },
                      fields:
                        "gridProperties.rowCount,gridProperties.columnCount",
                    },
                  },
                ],
              },
            });

            console.log(`✅ Sheet expanded to ${newRowCount} rows`);

            // Retry the batch after expansion
            await oauthSheets.spreadsheets.values.update({
              spreadsheetId: spreadsheetId,
              range: `${sheetName}!${batchStartCell}`,
              valueInputOption: "RAW",
              requestBody: {
                values: batchValues,
              },
            });

            console.log(
              `✅ Batch ${i + 1} inserted successfully after expansion`
            );
          } catch (expansionError) {
            console.error("Failed to expand sheet:", expansionError.message);
            throw batchError; // Re-throw original error
          }
        } else {
          throw batchError; // Re-throw if it's not a grid limits error
        }
      }
    }

    // Format headers (make them bold) - only if we have headers
    if (
      values.length > 0 &&
      (headers || (tableData[0] && typeof tableData[0] === "object"))
    ) {
      try {
        await oauthSheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1,
                    startColumnIndex: 0,
                    endColumnIndex: values[0].length,
                  },
                  cell: {
                    userEnteredFormat: {
                      textFormat: {
                        bold: true,
                      },
                      backgroundColor: {
                        red: 0.9,
                        green: 0.9,
                        blue: 0.9,
                      },
                    },
                  },
                  fields: "userEnteredFormat(textFormat,backgroundColor)",
                },
              },
            ],
          },
        });

        console.log("✅ Headers formatted successfully");
      } catch (formatError) {
        console.warn(
          "Failed to format headers (non-critical):",
          formatError.message
        );
      }
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    res.status(200).json({
      message: "Table sheet created successfully",
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      totalRows: values.length,
      dataRows: tableData.length,
      sheetDimensions: {
        rows: requiredRows,
        columns: requiredColumns,
      },
      authMethod: "OAuth2",
      batchesProcessed: totalBatches,
      hasHeaders:
        !!headers || (tableData[0] && typeof tableData[0] === "object"),
    });
  } catch (error) {
    console.error("Error creating table sheet:", error);

    let errorMessage = `Failed to create table sheet: ${error.message}`;
    if (error.code === 403) {
      errorMessage =
        "Permission denied. Please check your OAuth2 credentials and permissions.";
    } else if (error.code === 401) {
      errorMessage = "Authentication failed. Please refresh your OAuth2 token.";
    } else if (error.message.includes("quota")) {
      errorMessage = "API quota exceeded. Please try again later.";
    } else if (error.message.includes("grid limits")) {
      errorMessage =
        "Sheet size exceeded. The function will attempt to expand the sheet automatically.";
    }

    next(createError(500, errorMessage));
  }
};
