/*
 * authUser
 * attempt to resolve which user this route is trying to work with.
 */
const async = require("async");
const AB = require("ab-utils");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

/*
 * this is a common req.ab instance for performing user lookups:
 */
const reqAB = AB.reqAB({}, {});
reqAB.jobID = "authUser";

/*
 * Passport Initialization:
 */
passport.serializeUser(function(user, done) {
   done(null, user.uuid);
});
passport.deserializeUser(function(uuid, done) {
   reqAB.serviceRequest("user_manager.find", { uuid }, (err, user) => {
      if (err) {
         done(err);
         return;
      }
      done(null, user);
   });
});

passport.use(
   new LocalStrategy(function(email, password, done) {
      reqAB.serviceRequest(
         "user_manager.find.password",
         { email, password },
         (err, user) => {
            if (err) {
               done(err);
               return;
            }
            done(null, user);
         }
      );
   })
);

const passportInitialize = passport.initialize();
const passportSession = passport.session();

module.exports = (req, res, next) => {
   async.series(
      [
         (done) => {
            passportInitialize(req, res, (err) => {
               done(err);
            });
         },
         (done) => {
            passportSession(req, res, (err) => {
               done(err);
            });
         },
         (done) => {
            // there are several ways a User can be specified:

            // - session: user_id:'aedasl;dkfjasdlkfj'
            if (req.session && req.session.user_id) {
               req.ab.log("authUser -> session");
               var userID = req.session.user_id;
               req.ab.serviceRequest(
                  "user_manager.find",
                  { uuid: userID },
                  (err, user) => {
                     if (err) {
                        done(err);
                        return;
                     }
                     req.ab.user = user;
                     done(null, user);
                  }
               );
               return;
            } else {
               // the user is unknown at this point.
               // they should be initialized on the initial "post /login" route

               // we will assign the passport to the req.ab obj,
               // then let later processing decide what to do with
               // an unknown user.
               req.ab.log("unknown user");
               req.ab.passport = passport;
               done();
            }
         }
      ],
      (err) => {
         next(err);
      }
   );
};
