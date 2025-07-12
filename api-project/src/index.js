import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to api-project API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
