require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();

//import middleware
const errHandler = require("./middlewares/error");

//import routes
const scrapeRouter = require("./routes/scrape-route");
const dataSheetsRouter = require("./routes/dataSheets-route");

//set cors origin to all
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));

app.use("/scrape", scrapeRouter);
app.use("/data-sheets", dataSheetsRouter);

app.use(errHandler);

const PORT = process.env.PORT || 8100;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
