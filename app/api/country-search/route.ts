import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    
    if (!query) {
      return Response.json({ error: "Query parameter 'q' is required" }, { status: 400 })
    }

    // Search for countries by name using REST Countries API
    const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({ 
          countries: [], 
          message: `No countries found for "${query}"` 
        })
      }
      throw new Error(`REST Countries API error: ${response.status}`)
    }

    const countries = await response.json()
    
    // Format the response to include relevant information
    const formattedCountries = countries.map((country: any) => ({
      name: country.name.common,
      officialName: country.name.official,
      capital: country.capital?.[0] || "N/A",
      region: country.region,
      subregion: country.subregion,
      population: country.population,
      area: country.area,
      currencies: country.currencies ? Object.keys(country.currencies).map(code => ({
        code,
        name: country.currencies[code].name,
        symbol: country.currencies[code].symbol
      })) : [],
      languages: country.languages ? Object.values(country.languages) : [],
      flag: country.flag,
      cca2: country.cca2, // 2-letter country code
      cca3: country.cca3, // 3-letter country code
      timezones: country.timezones || [],
      continents: country.continents || []
    }))

    return Response.json({
      countries: formattedCountries,
      total: formattedCountries.length,
      query
    })

  } catch (error) {
    console.error("Country search error:", error)
    return Response.json(
      { 
        error: "Failed to search countries", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return Response.json({ error: "Query is required" }, { status: 400 })
    }

    // Search for countries by name using REST Countries API
    const response = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`)
    
    if (!response.ok) {
      if (response.status === 404) {
        return Response.json({ 
          countries: [], 
          message: `No countries found for "${query}"` 
        })
      }
      throw new Error(`REST Countries API error: ${response.status}`)
    }

    const countries = await response.json()
    
    // Format the response to include relevant information
    const formattedCountries = countries.map((country: any) => ({
      name: country.name.common,
      officialName: country.name.official,
      capital: country.capital?.[0] || "N/A",
      region: country.region,
      subregion: country.subregion,
      population: country.population,
      area: country.area,
      currencies: country.currencies ? Object.keys(country.currencies).map(code => ({
        code,
        name: country.currencies[code].name,
        symbol: country.currencies[code].symbol
      })) : [],
      languages: country.languages ? Object.values(country.languages) : [],
      flag: country.flag,
      cca2: country.cca2, // 2-letter country code
      cca3: country.cca3, // 3-letter country code
      timezones: country.timezones || [],
      continents: country.continents || []
    }))

    return Response.json({
      countries: formattedCountries,
      total: formattedCountries.length,
      query
    })

  } catch (error) {
    console.error("Country search error:", error)
    return Response.json(
      { 
        error: "Failed to search countries", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}
