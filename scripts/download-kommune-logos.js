#!/usr/bin/env node
// Downloads municipality coat of arms from Norwegian Wikipedia for all ~356 Norwegian municipalities.
// Images are saved to public/kommuner/{kommunenummer}.png
// Run: node scripts/download-kommune-logos.js

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const OUT_DIR = path.resolve(__dirname, "../public/kommuner");

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(
      url,
      {
        headers: {
          "User-Agent":
            "GarageConfiguratorBot/1.0 (https://garasjeproffen.no; contact@garasjeproffen.no)",
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            buffer: Buffer.concat(chunks),
            json() {
              return JSON.parse(this.buffer.toString());
            },
          })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getMunicipalities() {
  console.log("Fetching municipality list from SSB...");
  const res = await get(
    "https://data.ssb.no/api/klass/v1/classifications/131/codes.json?from=2024-01-01"
  );
  const data = res.json();
  // 4-digit codes are municipalities; 2-digit are counties
  return (data.codes || []).filter((c) => /^\d{4}$/.test(c.code));
}

async function getWikipediaThumbnail(name) {
  // Try both "X kommune" and just "X"
  const titles = [name + " kommune", name];
  for (const title of titles) {
    const url =
      "https://no.wikipedia.org/w/api.php?action=query" +
      "&titles=" +
      encodeURIComponent(title) +
      "&prop=pageimages&format=json&pithumbsize=400&redirects=1";

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await get(url);
        if (res.status === 429) {
          // Back off and retry
          const wait = (attempt + 1) * 2000;
          process.stdout.write(` [429, wait ${wait / 1000}s]`);
          await sleep(wait);
          continue;
        }
        const data = res.json();
        const pages = data.query?.pages ?? {};
        const page = Object.values(pages)[0];
        if (page && !page.missing && page.thumbnail?.source) {
          return page.thumbnail.source;
        }
        break; // no image on this title, try next
      } catch {
        await sleep(500);
      }
    }
    await sleep(150);
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const municipalities = await getMunicipalities();
  console.log(`Found ${municipalities.length} municipalities\n`);

  let ok = 0,
    skip = 0,
    miss = 0,
    fail = 0;

  for (let i = 0; i < municipalities.length; i++) {
    const m = municipalities[i];
    const filePath = path.join(OUT_DIR, `${m.code}.png`);

    if (fs.existsSync(filePath)) {
      process.stdout.write(`  SKIP  ${m.code}  ${m.name}\n`);
      skip++;
      continue;
    }

    try {
      const imgUrl = await getWikipediaThumbnail(m.name);
      if (!imgUrl) {
        process.stdout.write(`  MISS  ${m.code}  ${m.name}\n`);
        miss++;
        await sleep(150);
        continue;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const imgRes = await get(imgUrl);
        if (imgRes.status === 429) { await sleep((attempt + 1) * 2000); continue; }
        if (imgRes.status !== 200) throw new Error(`HTTP ${imgRes.status}`);
        fs.writeFileSync(filePath, imgRes.buffer);
        break;
      }
      process.stdout.write(`  OK    ${m.code}  ${m.name}\n`);
      ok++;
    } catch (e) {
      process.stdout.write(`  FAIL  ${m.code}  ${m.name}  – ${e.message}\n`);
      fail++;
    }

    // ~2 requests/second to stay within Wikipedia limits
    await sleep(500);

    // Progress every 20 municipalities
    if ((i + 1) % 20 === 0) {
      console.log(
        `\n--- Progress: ${i + 1}/${municipalities.length} (${ok} OK, ${miss} no image, ${fail} errors) ---\n`
      );
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Downloaded : ${ok}`);
  console.log(`Skipped    : ${skip} (already existed)`);
  console.log(`No image   : ${miss}`);
  console.log(`Errors     : ${fail}`);
  console.log(`Output dir : ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
