require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");

// Basic Configuration
const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

app.use(cors());
app.use("/public", express.static(`${process.cwd()}/public`));
app.use(express.urlencoded({ extended: true }));
app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

//MongoDB connection, schema, and CRUD functions
mongoose
  .connect(mongoURI)
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

const urlSchema = new mongoose.Schema({
  orig_url: {
    type: String,
    required: true,
  },
  short_url: {
    type: Number,
  },
});

const siteURL = mongoose.model("url", urlSchema);

const checkAndCreateShortUrl = async (inUrl, res) => {
  // Check if valid URL
  const urlRegex =
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
  if (!urlRegex.test(inUrl)) {
    return res.json({ error: "invalid url" });
  }

  try {
    // Check DB for existing URL
    const data = await siteURL.findOne({ orig_url: inUrl });

    if (data) {
      // If URL exists, return the existing short URL
      return res.json({
        original_url: data.orig_url,
        short_url: data.short_url,
      });
    } else {
      // Increment short_url based on the number of existing documents
      const count = await siteURL.countDocuments({});

      const newShortUrlId = count + 1;

      const newShortUrl = new siteURL({
        orig_url: inUrl,
        short_url: newShortUrlId,
      });

      const savedData = await newShortUrl.save();

      return res.json({
        original_url: savedData.orig_url,
        short_url: savedData.short_url,
      });
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

//for directing users to original url
const findOrigUrl = async (inUrl) => {
  const data = await siteURL.findOne({ short_url: inUrl });

  if (!data) {
    return null;
  } else {
    return data.orig_url;
  }
};

// Your first API endpoint
app.post("/api/shorturl/", (req, res) => {
  const postedUrl = req.body.url;
  return checkAndCreateShortUrl(postedUrl, res);
});

app.get("/api/shorturl/:inUrl", async (req, res) => {
  const inUrl = req.params.inUrl;
  const longUrl = await findOrigUrl(inUrl);
  if (longUrl) {
    res.redirect(longUrl);
  } else {
    res.json({ error: "url not found" });
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
