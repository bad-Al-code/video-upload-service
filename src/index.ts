import 'dotenv/config';

import express, { Request, Response } from 'express';
import { Resend } from 'resend';

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.get('/', async (req: Request, res: Response): Promise<any> => {
    const { data, error } = await resend.emails.send({
        from: process.env.DOMAIN_NAME as string,
        to: 'emailforsomework@gmail.com',
        subject: 'hello world',
        html: '<strong>it works!</strong>',
    });

    if (error) {
        return res.status(400).json({ error });
    }

    res.status(200).json({ data });
});

app.listen(3000, () => {
    console.log('Listening on http://localhost:3000');
});
