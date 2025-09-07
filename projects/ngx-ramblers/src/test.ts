// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import "zone.js/testing";
import { getTestBed } from "@angular/core/testing";
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from "@angular/platform-browser-dynamic/testing";
import moment from "moment-timezone";

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
platformBrowserDynamicTesting()
);

// Ensure consistent timezone for all date tests across CI/local
moment.tz.setDefault("Europe/London");
