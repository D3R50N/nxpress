import type { Request, Response } from 'express';
import type { NxpressMetadata } from '../../src';

export function metadata(req: Request, res: Response): NxpressMetadata {
  return {
    title: 'About Nxpress - High Performance SSR',
    description: 'Learn about Nxpress architecture, features, and core principles.',
  };
}

export default async function props(req: Request, res: Response) {
  return {
    features: [
      {
        icon: 'zap',
        title: 'Full Express Compatibility',
        desc: 'Works seamlessly on top of standard Express.js with 100% ecosystem compatibility.',
      },
      {
        icon: 'folder-tree',
        title: 'File-Based Routing',
        desc: 'Automatic routing for pages, nested layouts, and REST API endpoints directly from files.',
      },
      {
        icon: 'shield-check',
        title: 'Cascading Middlewares',
        desc: 'Apply middleware hierarchies with route inheritance, selective ignore, and route guards.',
      },
      {
        icon: 'component',
        title: 'Reusable Components',
        desc: 'Render nested template components with clean helper syntax across views.',
      },
      {
        icon: 'globe',
        title: 'Native Internationalization',
        desc: 'First-class i18n support with automatic language detection and translation dictionary.',
      },
      {
        icon: 'moon',
        title: 'Zero-Config Dark Mode',
        desc: 'Built-in client-side theme manager with instant dark/light switching support.',
      },
    ],
  };
}
