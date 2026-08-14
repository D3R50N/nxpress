import path from 'path';
import { nxpress, serve } from '../../src/server';

const PORT = 3001;

const app=nxpress({
  port: PORT,
  
  rootDir: __dirname,
  engine: 'ejs',
  globals: {
    siteName: 'Nexpress EJS Store',
    author: 'Nexpress Team',
    version: '1.0.0',
    currency: '€',
  },
});
app.get('/',(req,res,next)=>{
next()
})

app.use((req,res,next)=>{
  console.log('req');
  next();
})
app.listen(2000);