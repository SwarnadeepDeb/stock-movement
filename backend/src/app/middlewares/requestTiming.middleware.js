const requestTiming = (req, res, next) => {
    req.startTime = Date.now();
    next();
};

export default requestTiming;
