import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const baseCurrency = searchParams.get("base")
    const targetCurrency = searchParams.get("target")
    const amount = searchParams.get("amount")
    
    if (!baseCurrency || !targetCurrency) {
      return Response.json({ 
        error: "Both 'base' and 'target' currency parameters are required" 
      }, { status: 400 })
    }
    
    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Exchange Rate API key not configured" }, { status: 500 })
    }

    // Build URL with optional amount
    let url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${baseCurrency}/${targetCurrency}`
    if (amount) {
      url += `/${amount}`
    }

    // Call Exchange Rate API Pair endpoint
    const response = await fetch(url)
    
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

    const result = {
      result: data.result,
      baseCurrency: data.base_code,
      targetCurrency: data.target_code,
      conversionRate: data.conversion_rate,
      lastUpdate: data.time_last_update_utc,
      nextUpdate: data.time_next_update_utc
    }

    // Include conversion result if amount was provided
    if (amount && data.conversion_result) {
      result.conversionResult = data.conversion_result
      result.amount = parseFloat(amount)
    }

    return Response.json(result)

  } catch (error) {
    console.error("Exchange rate pair error:", error)
    return Response.json(
      { 
        error: "Failed to convert currency pair", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { baseCurrency, targetCurrency, amount } = await request.json()
    
    if (!baseCurrency || !targetCurrency) {
      return Response.json({ 
        error: "Both 'baseCurrency' and 'targetCurrency' are required" 
      }, { status: 400 })
    }
    
    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Exchange Rate API key not configured" }, { status: 500 })
    }

    // Build URL with optional amount
    let url = `https://v6.exchangerate-api.com/v6/${apiKey}/pair/${baseCurrency}/${targetCurrency}`
    if (amount) {
      url += `/${amount}`
    }

    // Call Exchange Rate API Pair endpoint
    const response = await fetch(url)
    
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

    const result = {
      result: data.result,
      baseCurrency: data.base_code,
      targetCurrency: data.target_code,
      conversionRate: data.conversion_rate,
      lastUpdate: data.time_last_update_utc,
      nextUpdate: data.time_next_update_utc
    }

    // Include conversion result if amount was provided
    if (amount && data.conversion_result) {
      result.conversionResult = data.conversion_result
      result.amount = parseFloat(amount)
    }

    return Response.json(result)

  } catch (error) {
    console.error("Exchange rate pair error:", error)
    return Response.json(
      { 
        error: "Failed to convert currency pair", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }, 
      { status: 500 }
    )
  }
}
