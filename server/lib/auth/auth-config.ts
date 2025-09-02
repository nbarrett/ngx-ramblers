import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import { uid } from "rand-token";
import passport from "passport";
import { envConfig } from "../env-config/env-config";
import passportJwt from "passport-jwt";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";

const SECRET = envConfig.auth.secret;
const fastExpire = false;
const ONE_DAY = {auth: 60 * 60 * 12, refresh: 60 * 60};
const THIRTY_SECONDS = {auth: 30, refresh: 30};
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

passport.serializeUser((user: Member, done) => {
  done(null, user.userName)
});
export const tokenExpiry = fastExpire ? THIRTY_SECONDS : ONE_DAY;

export function hashValue(value) {
  return hash(value, 10);
}

export function randomToken() {
  return uid(256);
}

export function signValue(value: string | object, expiry: number) {
  return jwt.sign(value, SECRET, {expiresIn: expiry});
}

export function compareValue(inputValue: string, storedValue: string) {
  return compare(inputValue, storedValue);
}

export function authenticate() {
  return passport.authenticate("jwt");
}
