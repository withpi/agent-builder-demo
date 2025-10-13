'use server'
import Exa from 'exa-js';


export async function searchWebResults(query: string, maxResults: number) {
  const exa = new Exa(process.env.EXA_API_KEY);
  return await exa.searchAndContents(query, {
    numResults: maxResults,
    highlights: true,
  });
}


export async function getFullWebContent(url: string) {
  const exa = new Exa(process.env.EXA_API_KEY);
  return await exa.getContents(url);
}