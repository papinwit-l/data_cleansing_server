const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");
const prisma = require("../config/prisma");

module.exports.auth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return createError(401, "unauthenticated");
    }
    const accessToken = authorization.split(" ")[1];
    if (accessToken === null) {
      return createError(401, "unauthenticated");
    }
    const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      createError(401, "unauthenticated user not found");
    }
    delete user.password;
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    next(error);
  }
};
