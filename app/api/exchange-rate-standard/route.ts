import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const baseCurrency = searchParams.get("base") || "USD"
    
    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Exchange Rate API key not configured" }, { status: 500 })
    }

    // Call Exchange Rate API Standard endpoint
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`)
    
    if (!response.ok) {
      throw new Error(`Exchange Rate API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.result === "error") {
      return Response.json({ 
        error: "Exchange Rate API error", 
        details: data["error-type"] 
      }, { status: 400 })
    }

    return Response.json({
      result: data.result,
      baseCurrency: data.base_code,
      lastUpdate: data.time_last_update_utc,
      nextUpdate: data.time_next_update_utc,
      conversionRates: data.conversion_rates,
      total: Object.keys(data.conversion_rates).length
    })

  } catch (error) {
    console.error("Exchange rate standard error:", error)
    return Response.json(
      { 
        error: "Failed to fetch exchange rates", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { baseCurrency = "USD" } = await request.json()
    
    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Exchange Rate API key not configured" }, { status: 500 })
    }

    // Call Exchange Rate API Standard endpoint
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`)
    
    if (!response.ok) {
      throw new Error(`Exchange Rate API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.result === "error") {
      return Response.json({ 
        error: "Exchange Rate API error", 
        details: data["error-type"] 
      }, { status: 400 })
    }

    return Response.json({
      result: data.result,
      baseCurrency: data.base_code,
      lastUpdate: data.time_last_update_utc,
      nextUpdate: data.time_next_update_utc,
      conversionRates: data.conversion_rates,
      total: Object.keys(data.conversion_rates).length
    })

  } catch (error) {
    console.error("Exchange rate standard error:", error)
    return Response.json(
      { 
        error: "Failed to fetch exchange rates", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}
