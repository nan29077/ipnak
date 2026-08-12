import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { filterMarineEnvironment, isFreshwaterSpecies } from "../src/lib/measurementEnvironment";

type Mode = "coastal" | "inland" | "retry";
let mode: Mode = "coastal";

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    geolocation: {
      getCurrentPosition(success: (position: unknown) => void) {
        success({ coords: { latitude: 37.7289, longitude: 126.69032 } });
      },
    },
  },
});

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith("/api/reverse-geocode")) {
    return Response.json({ name: mode === "retry" ? "경기도 파주시 교하동" : "경기도 파주시" });
  }
  if (url.startsWith("/api/weather/current")) {
    return Response.json({ weather: "맑음", temperature: 29.4 });
  }
  if (url.startsWith("/api/tide/current")) {
    return Response.json(mode === "inland"
      ? { waterTemp: null, mulddae: null, tidePhase: null, airTemp: null, windSpeed: null, windLabel: null }
      : { waterTemp: 30.8, mulddae: "5물", tidePhase: "밀물", airTemp: 29.4, windSpeed: 0.9, windLabel: "서북서" });
  }
  throw new Error(`Unexpected fetch: ${url}`);
}) as typeof fetch;

async function main() {
const { default: autoTagService } = await import("../src/services/AutoTagService.js");

mode = "coastal";
const coastal = await autoTagService.collectAll();
assert.ok(coastal.location);
assert.ok(coastal.weather);
assert.ok(coastal.tide);
assert.equal(coastal.location.locationName, "경기도 파주시");
assert.equal(coastal.weather.weather, "맑음");
assert.equal(coastal.weather.temperature, 29.4);
assert.equal(coastal.tide.waterTemp, 30.8);
assert.equal(coastal.tide.mulddae, "5물");
assert.equal(coastal.tide.tidePhase, "밀물");

mode = "inland";
const inland = await autoTagService.collectAll();
assert.ok(inland.weather);
assert.ok(inland.tide);
assert.equal(inland.weather.weather, "맑음");
assert.equal(inland.weather.temperature, 29.4);
assert.equal(inland.tide.waterTemp, null);
assert.equal(inland.tide.mulddae, null);
assert.equal(inland.tide.tidePhase, null);

assert.equal(isFreshwaterSpecies("붕어"), true);
assert.equal(isFreshwaterSpecies("붕어, 잉어"), true);
assert.equal(isFreshwaterSpecies("광어"), false);
const freshwaterFiltered = filterMarineEnvironment(
  { weather: "맑음", temperature: 29.4, waterTemp: 30.8, tideName: "5물", tidePhase: "밀물" },
  "붕어",
);
assert.equal(freshwaterFiltered.weather, "맑음");
assert.equal(freshwaterFiltered.temperature, 29.4);
assert.equal(freshwaterFiltered.waterTemp, null);
assert.equal(freshwaterFiltered.tideName, null);
assert.equal(freshwaterFiltered.tidePhase, null);

mode = "retry";
const completed = await autoTagService.complete({
  location: { latitude: 37.7289, longitude: 126.69032, locationName: null },
  weather: { weather: "맑음", temperature: null },
  tide: null,
});
assert.ok(completed.weather);
assert.ok(completed.tide);
assert.equal(completed.location.locationName, "경기도 파주시 교하동");
assert.equal(completed.weather.weather, "맑음", "기존 자동값을 보존해야 한다");
assert.equal(completed.weather.temperature, 29.4, "누락된 기온만 보완해야 한다");
assert.equal(completed.tide.waterTemp, 30.8);

const root = process.cwd();
const [measure, catchRoute, sync, spotColumns, spotModal, spotTab] = await Promise.all([
  readFile(path.join(root, "src/app/measure/page.tsx"), "utf8"),
  readFile(path.join(root, "src/app/api/catch/route.ts"), "utf8"),
  readFile(path.join(root, "src/services/SyncService.js"), "utf8"),
  readFile(path.join(root, "src/lib/ensureFishingSpotEnvColumns.ts"), "utf8"),
  readFile(path.join(root, "src/components/FishingSpotSaveModal.tsx"), "utf8"),
  readFile(path.join(root, "src/components/FishingSpotTab.tsx"), "utf8"),
]);

assert.match(measure, /region: tags\?\.location\?\.locationName/);
assert.match(measure, /tidePhase: env\.tidePhase/);
assert.match(catchRoute, /b\.region \?\? b\.locationName/);
assert.match(sync, /region: item\.locationName/);
assert.match(spotColumns, /tidePhase: "VARCHAR\(32\) NULL"/);
assert.match(spotModal, /수온·물때는 바다 또는 관측 가능한 지역만 자동 입력/);
assert.match(spotTab, /selected\.tideName, selected\.tidePhase/);

console.log("measurement environment verification: PASS");
console.log("- coastal auto tags: location/weather/temperature/water/tide/phase");
console.log("- inland optional tags: water/tide remain null without fabricated values");
console.log("- partial failure retry: missing values filled, existing values preserved");
console.log("- persistence wiring: diary/server sync/fishing spot fields connected");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
