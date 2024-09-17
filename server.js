import app from './app.js';
const port = process.env.PORT || 1992;

app.listen(
    process.env.PORT || 1992,
    console.log(`app listening on port ${port}`),
);