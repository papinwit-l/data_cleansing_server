require("dotenv").config();
const createError = require("../utils/createError");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../models/prisma");

// register
module.exports.register = async (req, res, next) => {
  const { name, email, password } = req.body;
  // console.log(req.body);
  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (user) {
      return createError(400, "Email already exist");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // const hashedPassword = await bcrypt.hash(password, 10);
    // const newUser = await prisma.user.create({
    //   data: {
    //     name,
    //     email,
    //     password: hashedPassword,
    //   },
    // });
    // res.status(201).json({ newUser });
    res.status(200).json({ message: "Register success", newUser });
  } catch (err) {
    next(err);
    console.log(err);
  }
};

//login
module.exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      return createError(400, "Email or password is not valid");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return createError(400, "Email or password is not valid");
    }
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);

    delete user.password;

    const response = {
      message: "Login success",
      user,
      token,
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
    console.log(err);
  }
};

// get me
module.exports.getMe = async (req, res, next) => {
  try {
    const { id, email } = req.user;
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (!user) {
      return createError(404, "User not found");
    }
    delete user.password;
    res.status(200).json({ user });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

//logout
module.exports.logout = async (req, res, next) => {
  try {
    res.clearCookie("access_token");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log(error);
    next(error);
  }
};
