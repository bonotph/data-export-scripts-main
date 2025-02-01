import jwt from 'jsonwebtoken';
import 'dotenv/config';

const requestCounts = {};
const RATE_LIMIT = 100; 
const TIME_WINDOW = 60 * 1000; 

export const authenticateKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).send('Unauthorized: API key is missing');
  }

  try {
    jwt.verify(apiKey, process.env.SECRET_KEY, (err, decoded) => {
      if (err || !decoded) {
        return res.status(401).send({
          message: "Unauthorized!",
        });
      }

      const currentTime = Date.now();
      const exp = decoded.exp
      if(!exp || currentTime > exp * 1000) {
        return res.status(401).send({ message: 'Token expired. Please login again.' });
      }

 

      if (!requestCounts[apiKey]) {
        requestCounts[apiKey] = { count: 1, startTime: currentTime };
      } else {
        const elapsedTime = currentTime - requestCounts[apiKey].startTime;
    
        if (elapsedTime < TIME_WINDOW) {
          requestCounts[apiKey].count++;
          if (requestCounts[apiKey].count > RATE_LIMIT) {
            return res.status(429).send('Too many requests');
          }
        } else {
          requestCounts[apiKey] = { count: 1, startTime: currentTime };
        }
      }

      next();
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
    console.log(err);
  }
};