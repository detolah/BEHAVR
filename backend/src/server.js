require('dotenv').config();
const createApp = require('./app');

const app = createApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`BEHAVR backend running on port ${PORT}`);
});
