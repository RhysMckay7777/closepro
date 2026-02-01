import { MetadataRoute } from 'next';
import { seo } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = seo.baseUrl;

  const publicRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/signin`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/pricing`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/dashboard`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  ];

  return publicRoutes;
}
