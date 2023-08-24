import bcrypt = require("bcryptjs");
import jwt = require("jsonwebtoken");
import randToken = require("rand-token");
import passport = require("passport");
import { envConfig } from "../env-config/env-config";
import passportJwt = require("passport-jwt");

const SECRET = envConfig.auth.secret;
const passportOpts = {
  jwtFromRequest: passportJwt.ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: SECRET
};

passport.use(new passportJwt.Strategy(passportOpts, (jwtPayload, done) => {
  const expirationDate = new Date(jwtPayload.exp * 1000);
  if (expirationDate < new Date()) {
    return done(null, false);
  }
  done(null, jwtPayload);
}));

passport.serializeUser((user, done) => {
  done(null, user.userName)
});

export const tokenExpiry = {auth: 60 * 60 * 12, refresh: 60 * 60};

export function hashValue(value) {
  return bcrypt.hash(value, 10);
}

export function randomToken() {
  return randToken.uid(256);
}

export function signValue(value, expiry) {
  return jwt.sign(value, SECRET, {expiresIn: expiry});
}

export function compareValue(inputValue, storedValue) {
  return bcrypt.compare(inputValue, storedValue);
}

export function authenticate() {
  return passport.authenticate("jwt");
}
