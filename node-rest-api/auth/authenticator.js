import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.SECRET_KEY; 
const users = [];

const username = process.env.ACCOUNT_USERNAME;
const password = process.env.ACCOUNT_PASSWORD;
const saltRounds = 10;
bcrypt.hash(password, saltRounds, function(err, hash) {
  const newUser = {
    id: users.length + 1,
    username,
    password: hash
  };
  users.push(newUser);
});
export async function authenticator(req, res){
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

    res.json({
      data: {
        user: {
          id: user.id,
          username: user.username
        }
      },
      token
    });
  }

