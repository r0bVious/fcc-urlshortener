require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("dns");
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use("/public", express.static(`${process.cwd()}/public`));
app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// MongoDB connection, schema, and CRUD functions
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

const dnsLookupAsync = (inUrl) => {
  const domain = new URL(inUrl).hostname;
  console.log("Performing DNS lookup for", domain);
  return new Promise((resolve, reject) => {
    dns.lookup(domain, (err) => {
      if (err) {
        console.log("DNS lookup failed:", err);
        return reject(new Error("invalid url"));
      }

      console.log("dns lookup success");
      resolve();
    });
  });
};

const checkAndCreateShortUrl = async (inUrl, res) => {
  // const urlRegex = /^(https?:\/\/)(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\S*)?$/;
  // console.log("Checking URL:", inUrl);

  // if (!urlRegex.test(inUrl)) {
  //   console.log("regex error when checking:", inUrl);
  //   return res.json({ error: "invalid url" });
  // }

  // Proceed with DNS lookup to verify the URL
  const host = new URL(inUrl).hostname;
  console.log("checkAndCreateShortUrl host value:", host);

  try {
    await dnsLookupAsync(inUrl);
  } catch (err) {
    console.log("dnslookup error");
    return res.json({ error: "invalid url" });
  }

  // Continue with DB lookup and creation logic
  try {
    const data = await siteURL.findOne({ orig_url: inUrl });
    if (data) {
      return res.json({
        original_url: data.orig_url,
        short_url: data.short_url,
      });
    } else {
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

// For directing users to original url
const findOrigUrl = async (inUrl) => {
  const data = await siteURL.findOne({ short_url: inUrl });

  if (!data) {
    return null;
  } else {
    return data.orig_url;
  }
};

app.post("/api/shorturl/", (req, res) => {
  const postedUrl = req.body.url;
  console.log("url posted:", postedUrl);
  checkAndCreateShortUrl(postedUrl, res);
});

app.get("/api/shorturl/:inUrl", async (req, res) => {
  const inUrl = parseInt(req.params.inUrl);
  console.log("Given short url:", inUrl);

  if (isNaN(inUrl)) {
    return res.status(400).json({ error: "Invalid short URL" });
  }

  const longUrl = await findOrigUrl(inUrl);
  console.log("found in db, longUrl:", longUrl);
  if (longUrl) {
    res.redirect(longUrl);
  } else {
    res.json({ error: "url not found" });
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
