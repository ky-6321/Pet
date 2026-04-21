import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';

interface State {
  step: 'waiting' | 'name' | 'q1' | 'q2' | 'photo' | 'results';
  names: Record<string, string>;
  q1: Record<string, 'yes' | 'no'>;
  q2: Record<string, string>;
  photos: { id: string; url: string }[];
  q1Text: string;
  q2Text: string;
}

let state: State = {
  step: 'waiting',
  names: {},
  q1: {},
  q2: {},
  photos: [],
  q1Text: 'Do you have pets?',
  q2Text: 'What pets do you have?'
};

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Increase payload limit to 10MB to accommodate base64 images over websockets
  const io = new Server(server, {
    cors: { origin: '*' },
    maxHttpBufferSize: 1e7
  });

  const PORT = 3000;

  io.on('connection', (socket: Socket) => {
    // Send full initial state
    socket.emit('state:sync', state);

    // Host actions
    socket.on('host:set-step', (step: State['step']) => {
      state.step = step;
      io.emit('state:step-update', step);
    });

    socket.on('host:reset', () => {
      state = {
        step: 'waiting',
        names: {},
        q1: {},
        q2: {},
        photos: [],
        q1Text: state.q1Text, // preserve custom text on reset
        q2Text: state.q2Text
      };
      io.emit('state:sync', state);
    });

    socket.on('host:update-q1-text', (text: string) => {
      state.q1Text = text;
      io.emit('state:q1-text-update', text);
    });

    socket.on('host:update-q2-text', (text: string) => {
      state.q2Text = text;
      io.emit('state:q2-text-update', text);
    });

    // Client actions
    socket.on('client:set-name', (data: { userId: string, name: string }) => {
      state.names[data.userId] = data.name;
      io.emit('state:names-update', state.names);
    });

    socket.on('client:answer-q1', (data: { userId: string, answer: 'yes'|'no' }) => {
      state.q1[data.userId] = data.answer;
      io.emit('state:q1-update', state.q1);
    });

    socket.on('client:answer-q2', (data: { userId: string, answer: string }) => {
      state.q2[data.userId] = data.answer;
      io.emit('state:q2-update', state.q2);
    });

    socket.on('client:upload-photo', (data: { userId: string, photoBase64: string }) => {
      const newPhoto = { id: Date.now().toString() + '_' + Math.random(), url: data.photoBase64 };
      state.photos.push(newPhoto);
      io.emit('photo:new', newPhoto);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
