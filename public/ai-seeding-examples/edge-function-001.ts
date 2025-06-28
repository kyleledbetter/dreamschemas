import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
// AI-Generated Schema-Specific Logic - MUST BE FIRST
// Dynamic schema configuration with full table definitions
const SCHEMA_CONFIG = {
  batchSize: 50,
  maxRetries: 3,
  timeoutMs: 1200,
  tables: [
    {
      "id": "pggjjlinmjmcdi18dz",
      "name": "properties",
      "comment": "",
      "position": {
        "x": 50,
        "y": 50
      },
      "columns": [
        {
          "id": "dr2zc78oj59mcdi18dz",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the properties table."
        },
        {
          "id": "zok6b6ty0aimcdi18dz",
          "name": "street_address",
          "type": "VARCHAR",
          "nullable": true,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Street address of the property. Nullable as it might be missing."
        },
        {
          "id": "62fsuapjmxmcdi18dz",
          "name": "city",
          "type": "VARCHAR",
          "nullable": true,
          "length": 100,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "City of the property. Nullable as it might be missing."
        },
        {
          "id": "dtgkoyisiximcdi18dz",
          "name": "state",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "State of the property. Nullable as it might be missing."
        },
        {
          "id": "ne1ru13i2omcdi18dz",
          "name": "zip_code",
          "type": "VARCHAR",
          "nullable": true,
          "length": 20,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Zip code of the property. Stored as VARCHAR to handle potential non-numeric values or leading zeros. Nullable as it might be missing."
        },
        {
          "id": "mgxa3l450smcdi18dz",
          "name": "latitude",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 10,
          "scale": 7,
          "defaultValue": "",
          "constraints": [],
          "comment": "Latitude coordinate of the property. Nullable as it might be missing."
        },
        {
          "id": "juqz3z97dcgmcdi18dz",
          "name": "longitude",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 10,
          "scale": 7,
          "defaultValue": "",
          "constraints": [],
          "comment": "Longitude coordinate of the property. Nullable as it might be missing."
        },
        {
          "id": "3eixwpbznyjmcdi18dz",
          "name": "county_fips",
          "type": "VARCHAR",
          "nullable": true,
          "length": 10,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "County FIPS code. Stored as VARCHAR. Nullable as it might be missing."
        },
        {
          "id": "i0afn1ma52kmcdi18dz",
          "name": "parcel_number",
          "type": "VARCHAR",
          "nullable": true,
          "length": 100,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Parcel number of the property. Nullable as it might be missing."
        },
        {
          "id": "lk5nj5creimcdi18dz",
          "name": "subdivision",
          "type": "VARCHAR",
          "nullable": true,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Subdivision name. Nullable as it might be missing."
        },
        {
          "id": "p1hbgcrbq3mcdi18dz",
          "name": "apn",
          "type": "VARCHAR",
          "nullable": true,
          "length": 100,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Assessor's Parcel Number. Nullable as it might be missing."
        },
        {
          "id": "lsqt7yy1yokmcdi18dz",
          "name": "assessed_improvement_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Assessed value of improvements on the property. Nullable as it might be missing."
        },
        {
          "id": "01olhqjefhrymcdi18dz",
          "name": "assessed_land_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Assessed value of the land. Nullable as it might be missing."
        },
        {
          "id": "p9ikhw9ulwjmcdi18dz",
          "name": "total_assessed_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Total assessed value of the property. Nullable as it might be missing."
        },
        {
          "id": "lyz20xw1ejpmcdi18dz",
          "name": "market_improvement_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Market value of improvements on the property. Nullable as it might be missing."
        },
        {
          "id": "6eblvcywyrjmcdi18dz",
          "name": "market_land_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Market value of the land. Nullable as it might be missing."
        },
        {
          "id": "5szjeg2yh9jmcdi18dz",
          "name": "total_market_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Total market value of the property. Nullable as it might be missing."
        },
        {
          "id": "nxlbcl1zuj9mcdi18dz",
          "name": "market_value_year",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Year the market value was assessed. Nullable as it might be missing."
        },
        {
          "id": "k8x0oslyr1omcdi18dz",
          "name": "tax_year",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Tax year for the assessment data. Nullable as it might be missing."
        },
        {
          "id": "9nhxmgs307kmcdi18dz",
          "name": "year_built",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Original year the property was built. Nullable as it might be missing."
        },
        {
          "id": "it0d9lo8hfmcdi18dz",
          "name": "effective_year_built",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Effective year built considering renovations. Nullable as it might be missing."
        },
        {
          "id": "218g7lvnm68mcdi18dz",
          "name": "num_of_stories",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 5,
          "scale": 2,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of stories in the building. Nullable as it might be missing."
        },
        {
          "id": "9np1srd85hpmcdi18dz",
          "name": "lot_size_square_feet",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Size of the property lot in square feet. Nullable as it might be missing."
        },
        {
          "id": "ph9zlz5wdxmcdi18dz",
          "name": "square_feet",
          "type": "INTEGER",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Building square footage. Nullable as it might be missing."
        },
        {
          "id": "kfhlre19pzkmcdi18dz",
          "name": "units",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of units in the building. Nullable as it might be missing."
        },
        {
          "id": "6wd01x3q31jmcdi18dz",
          "name": "number_of_bedrooms",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of bedrooms. Nullable as it might be missing."
        },
        {
          "id": "y7rb26fimvmcdi18dz",
          "name": "number_of_bathrooms",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 5,
          "scale": 2,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of bathrooms (including partial). Stored as DECIMAL to handle partial baths. Nullable as it might be missing."
        },
        {
          "id": "9at2lbequnmcdi18dz",
          "name": "number_of_partial_baths",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of partial bathrooms. Nullable as it might be missing."
        },
        {
          "id": "gq6usm25t8kmcdi18dz",
          "name": "total_number_of_rooms",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Total number of rooms. Nullable as it might be missing."
        },
        {
          "id": "a2c8qdqjy6amcdi18dz",
          "name": "num_of_buildings",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of buildings on the property. Nullable as it might be missing."
        },
        {
          "id": "feuvx9vinf8mcdi18dz",
          "name": "num_of_plumbing_fixtures",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of plumbing fixtures. Nullable as it might be missing."
        },
        {
          "id": "92d9cf6ckr7mcdi18dz",
          "name": "air_conditioning",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Indicator for air conditioning presence/type. Nullable as it might be missing."
        },
        {
          "id": "a6xx8z6wrtrmcdi18dz",
          "name": "air_conditioning_type",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Type of air conditioning. Nullable as it might be missing."
        },
        {
          "id": "l660lsaz94jmcdi18dz",
          "name": "basement",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Indicator for basement presence. Nullable as it might be missing."
        },
        {
          "id": "8pxrv91hwymcdi18dz",
          "name": "building_class",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Building class code. Nullable as it might be missing."
        },
        {
          "id": "aanyl70ly19mcdi18dz",
          "name": "building_quality",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Building quality code. Nullable as it might be missing."
        },
        {
          "id": "l9oq01dxf6fmcdi18dz",
          "name": "elevator",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean indicator for elevator presence. Nullable as it might be missing."
        },
        {
          "id": "6vg2vwv9walmcdi18dz",
          "name": "exterior_walls",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Exterior wall material code. Nullable as it might be missing."
        },
        {
          "id": "h5vdqf5x95kmcdi18dz",
          "name": "fireplace",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean indicator for fireplace presence. Nullable as it might be missing."
        },
        {
          "id": "v645y2rmohjmcdi18dz",
          "name": "floor_cover",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Floor covering code. Nullable as it might be missing."
        },
        {
          "id": "9rdut14ao0emcdi18e0",
          "name": "foundation",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Foundation type code. Nullable as it might be missing."
        },
        {
          "id": "kn968sz607lmcdi18e0",
          "name": "garage_parking_num_of_cars",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Number of car spaces in the garage/parking. Nullable as it might be missing."
        },
        {
          "id": "lk9w5xc32omcdi18e0",
          "name": "garage_type_parking",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Type of garage/parking. Nullable as it might be missing."
        },
        {
          "id": "cehdwh9i7e9mcdi18e0",
          "name": "heating",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Indicator for heating presence/type. Nullable as it might be missing."
        },
        {
          "id": "lid4zbnnjg8mcdi18e0",
          "name": "heating_fuel_type",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Type of heating fuel. Nullable as it might be missing."
        },
        {
          "id": "0ieeg59qhewmcdi18e0",
          "name": "interior_walls",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Interior wall material code. Nullable as it might be missing."
        },
        {
          "id": "y5lvu2mw0rmcdi18e0",
          "name": "other_impr_building_indicator1",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Other improvement indicator 1. Nullable as it might be missing."
        },
        {
          "id": "zlk9wnh5hmmcdi18e0",
          "name": "other_impr_building_indicator2",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Other improvement indicator 2. Nullable as it might be missing."
        },
        {
          "id": "rejs0znh5dmcdi18e0",
          "name": "other_impr_building_indicator3",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Other improvement indicator 3. Nullable as it might be missing."
        },
        {
          "id": "vxwk7xw9tqkmcdi18e0",
          "name": "other_impr_building_indicator4",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Other improvement indicator 4. Nullable as it might be missing."
        },
        {
          "id": "4wii7um8zl7mcdi18e0",
          "name": "other_impr_building_indicator5",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Other improvement indicator 5. Nullable as it might be missing."
        },
        {
          "id": "q86u8uk3ezmmcdi18e0",
          "name": "pool",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean indicator for pool presence. Nullable as it might be missing."
        },
        {
          "id": "0eb2fmw857cmcdi18e0",
          "name": "roof_cover",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Roof covering code. Nullable as it might be missing."
        },
        {
          "id": "r04oa7tfk2mcdi18e0",
          "name": "roof_type",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Roof type code. Nullable as it might be missing."
        },
        {
          "id": "0iv0irw3z8bgmcdi18e0",
          "name": "sewer",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Sewer type indicator. Nullable as it might be missing."
        },
        {
          "id": "okzcadqx4yimcdi18e0",
          "name": "site_influence",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Site influence code. Nullable as it might be missing."
        },
        {
          "id": "9idnnhae2hmcdi18e0",
          "name": "standardized_land_use_code",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Standardized land use code. Nullable as it might be missing."
        },
        {
          "id": "flfrrti6izmmcdi18e0",
          "name": "style",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Property style code. Nullable as it might be missing."
        },
        {
          "id": "wsekl1oku4nmcdi18e0",
          "name": "topography",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Topography code. Nullable as it might be missing."
        },
        {
          "id": "iya8ijpxy6bmcdi18e0",
          "name": "type_construction",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Type of construction code. Nullable as it might be missing."
        },
        {
          "id": "iccqfypoy5amcdi18e0",
          "name": "water",
          "type": "VARCHAR",
          "nullable": true,
          "length": 50,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Water type indicator. Nullable as it might be missing."
        },
        {
          "id": "wapjjhnjknmcdi18e0",
          "name": "adu",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for Accessory Dwelling Unit. Nullable as it might be missing."
        },
        {
          "id": "pql7duj962mcdi18e0",
          "name": "bathroom_remodel",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for bathroom remodel. Nullable as it might be missing."
        },
        {
          "id": "b3w85rpmpnrmcdi18e0",
          "name": "decks_and_porches",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for decks and porches work. Nullable as it might be missing."
        },
        {
          "id": "tsm43qd12ymcdi18e0",
          "name": "demolition",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for demolition work. Nullable as it might be missing."
        },
        {
          "id": "h5vlr0cpvvpmcdi18e0",
          "name": "docks",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for docks work. Nullable as it might be missing."
        },
        {
          "id": "7rdt3ut5368mcdi18e0",
          "name": "doors_and_windows",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for doors and windows work. Nullable as it might be missing."
        },
        {
          "id": "d16pu4vlvammcdi18e0",
          "name": "electrical_work",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for electrical work. Nullable as it might be missing."
        },
        {
          "id": "lgfwhmyb06mcdi18e0",
          "name": "excavation_and_grading",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for excavation and grading. Nullable as it might be missing."
        },
        {
          "id": "dl0gbyk712mcdi18e0",
          "name": "fences",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for fences work. Nullable as it might be missing."
        },
        {
          "id": "8xscbkqom4fmcdi18e0",
          "name": "flatwork_concrete",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for flatwork concrete. Nullable as it might be missing."
        },
        {
          "id": "6u0kammg72amcdi18e0",
          "name": "foundations_flag",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for foundations work. Nullable as it might be missing."
        },
        {
          "id": "ukqjcgqemfdmcdi18e0",
          "name": "garage_construction",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for garage construction. Nullable as it might be missing."
        },
        {
          "id": "u5jk0ooadtmcdi18e0",
          "name": "hvac_flag",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for HVAC work. Nullable as it might be missing."
        },
        {
          "id": "wqopwfiogcmcdi18e0",
          "name": "home_addition",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for home addition. Nullable as it might be missing."
        },
        {
          "id": "j8bq4umipfqmcdi18e0",
          "name": "kitchen_remodel",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for kitchen remodel. Nullable as it might be missing."
        },
        {
          "id": "gyw76in2l5mcdi18e0",
          "name": "landscape",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for landscape work. Nullable as it might be missing."
        },
        {
          "id": "gnsb123fn96mcdi18e0",
          "name": "mechanical_work_flag",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for mechanical work. Nullable as it might be missing."
        },
        {
          "id": "ixa45jumd9lmcdi18e0",
          "name": "mobile_homes",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for mobile homes work. Nullable as it might be missing."
        },
        {
          "id": "dtlenuyn38mmcdi18e0",
          "name": "multi_room_remodel",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for multi-room remodel. Nullable as it might be missing."
        },
        {
          "id": "x3sxi73hi0mmcdi18e0",
          "name": "patios",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for patios work. Nullable as it might be missing."
        },
        {
          "id": "yto481zxfvmcdi18e0",
          "name": "paving_driveways_and_sidewalks",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for paving, driveways, and sidewalks. Nullable as it might be missing."
        },
        {
          "id": "vqe8gwu5glmcdi18e0",
          "name": "plumbing_flag",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for plumbing work. Nullable as it might be missing."
        },
        {
          "id": "s4rryxonwfdmcdi18e0",
          "name": "pole_barn",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for pole barn construction. Nullable as it might be missing."
        },
        {
          "id": "etv77vgww28mcdi18e0",
          "name": "pool_and_spa_construction",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for pool and spa construction. Nullable as it might be missing."
        },
        {
          "id": "m1btvnhu3kamcdi18e0",
          "name": "retaining_walls",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for retaining walls. Nullable as it might be missing."
        },
        {
          "id": "svb3fhwt0aemcdi18e0",
          "name": "roofing_flag",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for roofing work. Nullable as it might be missing."
        },
        {
          "id": "27ewcsasjrwmcdi18e0",
          "name": "sewer_laterals",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for sewer laterals work. Nullable as it might be missing."
        },
        {
          "id": "5irzqkrke2dmcdi18e0",
          "name": "siding",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for siding work. Nullable as it might be missing."
        },
        {
          "id": "kcoujdewjf7mcdi18e0",
          "name": "solar_installation",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag for solar installation. Nullable as it might be missing."
        },
        {
          "id": "e2ryu581ifmcdi18e0",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "rrs5sdh5j4mcdi18e0",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "d994ews3wy9mcdi18e0",
          "name": "idx_properties_zip_code",
          "columns": [
            "zip_code"
          ],
          "unique": false
        },
        {
          "id": "fi2ncd1tgmkmcdi18e0",
          "name": "idx_properties_city",
          "columns": [
            "city"
          ],
          "unique": false
        },
        {
          "id": "uwfc8yr29nmcdi18e0",
          "name": "idx_properties_state",
          "columns": [
            "state"
          ],
          "unique": false
        },
        {
          "id": "mtji37xphmcdi18e0",
          "name": "idx_properties_parcel_number",
          "columns": [
            "parcel_number"
          ],
          "unique": false
        },
        {
          "id": "l5v7896gbfmcdi18e0",
          "name": "idx_properties_apn",
          "columns": [
            "apn"
          ],
          "unique": false
        }
      ]
    },
    {
      "id": "4nb0degqjjdmcdi18e0",
      "name": "sales",
      "comment": "",
      "position": {
        "x": 400,
        "y": 50
      },
      "columns": [
        {
          "id": "9tsdxk72xxmcdi18e0",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the sales table."
        },
        {
          "id": "snduxwfujimcdi18e0",
          "name": "property_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "properties",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking the sale to a property. Nullable if property cannot be matched."
        },
        {
          "id": "r0bpc3xw5h8mcdi18e1",
          "name": "sale_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date of the sale. Nullable as it might be missing."
        },
        {
          "id": "3l9lrm6f0lvmcdi18e1",
          "name": "sale_price",
          "type": "NUMERIC",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Sale price of the property. Nullable as it might be missing."
        },
        {
          "id": "56k23diw5vdmcdi18e1",
          "name": "loan_amount",
          "type": "NUMERIC",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Loan amount associated with the sale. Nullable as it might be missing."
        },
        {
          "id": "guqpclhxrcsmcdi18e1",
          "name": "loan_type_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "loan_types",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the loan type lookup table. Nullable if type is unknown or missing."
        },
        {
          "id": "unnvk9ke8gpmcdi18e1",
          "name": "product_class_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "product_classes",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the product class lookup table. Nullable if class is unknown or missing."
        },
        {
          "id": "9mqmf6bjs6smcdi18e1",
          "name": "product_type_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "product_types",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the product type lookup table. Nullable if type is unknown or missing."
        },
        {
          "id": "6guo3u22yvemcdi18e1",
          "name": "transaction_type_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "transaction_types",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the transaction type lookup table. Nullable if type is unknown or missing."
        },
        {
          "id": "u0ki8w0q5ncmcdi18e1",
          "name": "builder_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "builders",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the builder lookup table. Nullable if builder is unknown or missing."
        },
        {
          "id": "i5uaflwrixsmcdi18e1",
          "name": "buildermatch_flag",
          "type": "BOOLEAN",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Boolean flag indicating if a builder was matched. Nullable as it might be missing."
        },
        {
          "id": "hskg64a3sb9mcdi18e1",
          "name": "delivery_date",
          "type": "DATE",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Anticipated delivery date. Nullable as it might be missing."
        },
        {
          "id": "tntxpqqw94rmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "si34c92zd2smcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "sduktvqgv4gmcdi18e1",
          "name": "idx_sales_property_id",
          "columns": [
            "property_id"
          ],
          "unique": false
        },
        {
          "id": "431okdsozi3mcdi18e1",
          "name": "idx_sales_sale_date",
          "columns": [
            "sale_date"
          ],
          "unique": false
        },
        {
          "id": "gqrs7snm3vgmcdi18e1",
          "name": "idx_sales_builder_id",
          "columns": [
            "builder_id"
          ],
          "unique": false
        }
      ]
    },
    {
      "id": "h87fsbfs9wsmcdi18e1",
      "name": "permits",
      "comment": "",
      "position": {
        "x": 750,
        "y": 50
      },
      "columns": [
        {
          "id": "aty2g24a98mcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the permits table."
        },
        {
          "id": "bv9rtzf0limmcdi18e1",
          "name": "property_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "properties",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking the permit to a property. Nullable if property cannot be matched."
        },
        {
          "id": "u3lda4w8b8mcdi18e1",
          "name": "permit_number",
          "type": "VARCHAR",
          "nullable": true,
          "length": 100,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Unique identifier for the permit. Nullable as it might be missing."
        },
        {
          "id": "c3ws5cz42wmmcdi18e1",
          "name": "description",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Description of the permit work. Nullable as it might be missing."
        },
        {
          "id": "z8w39qj8hqmcdi18e1",
          "name": "type_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "permit_types",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the permit type lookup table. Nullable if type is unknown or missing."
        },
        {
          "id": "wr192yb3wyqmcdi18e1",
          "name": "subtype_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "permit_subtypes",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the permit subtype lookup table. Nullable if subtype is unknown or missing."
        },
        {
          "id": "wlvfobp5hodmcdi18e1",
          "name": "project_name",
          "type": "VARCHAR",
          "nullable": true,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Name of the project associated with the permit. Nullable as it might be missing."
        },
        {
          "id": "6ypx4svrst2mcdi18e1",
          "name": "business_name_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "business_names",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the business name (contractor) lookup table. Nullable if business is unknown or missing."
        },
        {
          "id": "kedwxgkskkmcdi18e1",
          "name": "job_value",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Estimated value of the job. Nullable as it might be missing."
        },
        {
          "id": "3ckgs4xwhr9mcdi18e1",
          "name": "fees",
          "type": "BIGINT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Fees associated with the permit. Nullable as it might be missing."
        },
        {
          "id": "rycw2ll37ofmcdi18e1",
          "name": "permit_jurisdiction_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "jurisdictions",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the permit jurisdiction lookup table. Nullable if jurisdiction is unknown or missing."
        },
        {
          "id": "bdwqvlwk23mcdi18e1",
          "name": "project_type_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "project_types",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the project type lookup table. Nullable if type is unknown or missing."
        },
        {
          "id": "948w6c01vltmcdi18e1",
          "name": "initial_status_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "permit_statuses",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the initial permit status lookup table. Nullable if status is unknown or missing."
        },
        {
          "id": "wqr80klrpinmcdi18e1",
          "name": "initial_status_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date of the initial permit status. Nullable as it might be missing."
        },
        {
          "id": "vvdytsz2jmcdi18e1",
          "name": "latest_status_id",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "FOREIGN KEY",
              "referencedTable": "permit_statuses",
              "referencedColumn": "id"
            }
          ],
          "comment": "Foreign key linking to the latest permit status lookup table. Nullable if status is unknown or missing."
        },
        {
          "id": "9ry0id9l4bdmcdi18e1",
          "name": "latest_status_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date of the latest permit status. Nullable as it might be missing."
        },
        {
          "id": "tri6c8uqgjpmcdi18e1",
          "name": "applied_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date the permit was applied for. Nullable as it might be missing."
        },
        {
          "id": "l0n4t3x7o3hmcdi18e1",
          "name": "issued_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date the permit was issued. Nullable as it might be missing."
        },
        {
          "id": "orwbwlsrjcomcdi18e1",
          "name": "completed_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date the permit was completed. Nullable as it might be missing."
        },
        {
          "id": "vu1xdhiqizfmcdi18e1",
          "name": "cancelled_date",
          "type": "TEXT",
          "nullable": true,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [],
          "comment": "Date the permit was cancelled. Nullable as it might be missing."
        },
        {
          "id": "b5y3cysk3xrmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "pnxcr1fpxjjmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "j6knx4rxeo8mcdi18e1",
          "name": "idx_permits_property_id",
          "columns": [
            "property_id"
          ],
          "unique": false
        },
        {
          "id": "8so331fujl4mcdi18e1",
          "name": "idx_permits_permit_number",
          "columns": [
            "permit_number"
          ],
          "unique": false
        },
        {
          "id": "tet5dfqveiqmcdi18e1",
          "name": "idx_permits_latest_status_date",
          "columns": [
            "latest_status_date"
          ],
          "unique": false
        },
        {
          "id": "g1x6vyvfulpmcdi18e1",
          "name": "idx_permits_jurisdiction_id",
          "columns": [
            "permit_jurisdiction_id"
          ],
          "unique": false
        },
        {
          "id": "825xnv0buasmcdi18e1",
          "name": "idx_permits_business_name_id",
          "columns": [
            "business_name_id"
          ],
          "unique": false
        }
      ]
    },
    {
      "id": "x17imk0t4samcdi18e1",
      "name": "builders",
      "comment": "",
      "position": {
        "x": 1100,
        "y": 50
      },
      "columns": [
        {
          "id": "p7wq6x3816mcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the builders lookup table."
        },
        {
          "id": "2gt3o4jf3pkmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the builder."
        },
        {
          "id": "o9003m7bi1mcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "0f9bnj6yy4yqmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "813q3wbkpx8mcdi18e1",
          "name": "idx_builders_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "5v3g6hfgdupmcdi18e1",
      "name": "loan_types",
      "comment": "",
      "position": {
        "x": 50,
        "y": 350
      },
      "columns": [
        {
          "id": "lnx1qinos5smcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the loan types lookup table."
        },
        {
          "id": "1slpdqggg77mcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the loan type."
        },
        {
          "id": "erdiiwkpalnmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "ad1nq6zom9umcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "k9dbgp0r5lmcdi18e1",
          "name": "idx_loan_types_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "l7xh9w4c92tmcdi18e1",
      "name": "transaction_types",
      "comment": "",
      "position": {
        "x": 400,
        "y": 350
      },
      "columns": [
        {
          "id": "n8r4fmnvxhdmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the transaction types lookup table."
        },
        {
          "id": "tqzxvtfp3akmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the transaction type."
        },
        {
          "id": "legidys8ubmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "3gyliv4hauumcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "qcvh8rl5g1mmcdi18e1",
          "name": "idx_transaction_types_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "ptmdvc72qnsmcdi18e1",
      "name": "product_classes",
      "comment": "",
      "position": {
        "x": 750,
        "y": 350
      },
      "columns": [
        {
          "id": "znzf0ve6c1dmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the product classes lookup table."
        },
        {
          "id": "7td4rz0wqqbmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the product class."
        },
        {
          "id": "mhrbiivu93emcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "nlt909jb58jmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "jran9fyqjimcdi18e1",
          "name": "idx_product_classes_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "9m3fdtjlvs9mcdi18e1",
      "name": "product_types",
      "comment": "",
      "position": {
        "x": 1100,
        "y": 350
      },
      "columns": [
        {
          "id": "72xtujf3ycrmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the product types lookup table."
        },
        {
          "id": "t47x5o65k7amcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the product type."
        },
        {
          "id": "2uv9jpz2eq9mcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "6vspe9yv287mcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "wa90n8krabrmcdi18e1",
          "name": "idx_product_types_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "sxaob8i9jcmcdi18e1",
      "name": "permit_statuses",
      "comment": "",
      "position": {
        "x": 50,
        "y": 650
      },
      "columns": [
        {
          "id": "s09oloenihimcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the permit statuses lookup table."
        },
        {
          "id": "rdsbb3sgq7dmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the permit status."
        },
        {
          "id": "f9g6fekn4gmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "0s6q4vpjcladmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "v4medwfhlrnmcdi18e1",
          "name": "idx_permit_statuses_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "us89qdd5dmcdi18e1",
      "name": "permit_types",
      "comment": "",
      "position": {
        "x": 400,
        "y": 650
      },
      "columns": [
        {
          "id": "ldlaux1ylnrmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the permit types lookup table."
        },
        {
          "id": "t2rxm0n64wkmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the permit type."
        },
        {
          "id": "7toem23dcmmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "e413xbypqoumcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "tbd9rjk9iqmcdi18e1",
          "name": "idx_permit_types_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "mft5fko3a6mcdi18e1",
      "name": "permit_subtypes",
      "comment": "",
      "position": {
        "x": 750,
        "y": 650
      },
      "columns": [
        {
          "id": "uzp5d35muzmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the permit subtypes lookup table."
        },
        {
          "id": "om0nawe35c9mcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the permit subtype."
        },
        {
          "id": "fxqcfwl8xklmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "75tcua42luqmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "773n0ubhngrmcdi18e1",
          "name": "idx_permit_subtypes_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "jaarzfc6miomcdi18e1",
      "name": "project_types",
      "comment": "",
      "position": {
        "x": 1100,
        "y": 650
      },
      "columns": [
        {
          "id": "2q26o4ug3npmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the project types lookup table."
        },
        {
          "id": "dggfwcno5sqmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the project type."
        },
        {
          "id": "v7vmips0krmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "w7hi4rv5wimcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "5jrumxmuob7mcdi18e1",
          "name": "idx_project_types_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "k9hl6fd4aglmcdi18e1",
      "name": "jurisdictions",
      "comment": "",
      "position": {
        "x": 50,
        "y": 950
      },
      "columns": [
        {
          "id": "33bcu8m6lb8mcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the jurisdictions lookup table."
        },
        {
          "id": "m0891kwzqudmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the jurisdiction."
        },
        {
          "id": "61d7uxum8nhmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "9x132gzlsjwmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "vssuas6olzrmcdi18e1",
          "name": "idx_jurisdictions_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    },
    {
      "id": "48m789w7iagmcdi18e1",
      "name": "business_names",
      "comment": "",
      "position": {
        "x": 400,
        "y": 950
      },
      "columns": [
        {
          "id": "d2mvo0j2lpnmcdi18e1",
          "name": "id",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "PRIMARY KEY"
            },
            {
              "type": "DEFAULT",
              "value": "uuid_generate_v4()"
            }
          ],
          "comment": "Primary key for the business names lookup table."
        },
        {
          "id": "0q0c2ow59gxmcdi18e1",
          "name": "name",
          "type": "VARCHAR",
          "nullable": false,
          "length": 255,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "UNIQUE"
            }
          ],
          "comment": "Unique name of the business."
        },
        {
          "id": "vgeyl7fpgfhmcdi18e1",
          "name": "created_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record creation."
        },
        {
          "id": "2h2d5ciczexmcdi18e1",
          "name": "updated_at",
          "type": "TEXT",
          "nullable": false,
          "length": 0,
          "precision": 0,
          "scale": 0,
          "defaultValue": "",
          "constraints": [
            {
              "type": "DEFAULT",
              "value": "NOW()"
            }
          ],
          "comment": "Audit timestamp for record update."
        }
      ],
      "indexes": [
        {
          "id": "4qgxd9axwtpmcdi18e1",
          "name": "idx_business_names_name",
          "columns": [
            "name"
          ],
          "unique": true
        }
      ]
    }
  ],
  relationships: [
    {
      "source": "sales",
      "target": "properties"
    },
    {
      "source": "sales",
      "target": "loan_types"
    },
    {
      "source": "sales",
      "target": "product_classes"
    },
    {
      "source": "sales",
      "target": "product_types"
    },
    {
      "source": "sales",
      "target": "transaction_types"
    },
    {
      "source": "sales",
      "target": "builders"
    },
    {
      "source": "permits",
      "target": "properties"
    },
    {
      "source": "permits",
      "target": "permit_types"
    },
    {
      "source": "permits",
      "target": "permit_subtypes"
    },
    {
      "source": "permits",
      "target": "business_names"
    },
    {
      "source": "permits",
      "target": "jurisdictions"
    },
    {
      "source": "permits",
      "target": "project_types"
    },
    {
      "source": "permits",
      "target": "permit_statuses"
    },
    {
      "source": "permits",
      "target": "permit_statuses"
    }
  ]
};
const PERFORMANCE_CONFIG = {
  enableCaching: true,
  logLevel: 'info',
  validateData: true,
  complexityScore: 42
};
// Dynamic table processing - get table names from schema
const ALL_TABLES = SCHEMA_CONFIG.tables.map((t)=>t.name);
// Topologically sort tables to respect foreign key dependencies
const sortedTables = (()=>{
  const nodes = ALL_TABLES.map((name)=>({
      name,
      dependencies: new Set()
    }));
  const nameToNode = new Map(nodes.map((n)=>[
      n.name,
      n
    ]));
  (SCHEMA_CONFIG.relationships || []).forEach((rel)=>{
    // If rel.sourceTable depends on rel.targetTable...
    const sourceNode = nameToNode.get(rel.source);
    const targetNode = nameToNode.get(rel.target);
    if (sourceNode && targetNode) {
      sourceNode.dependencies.add(rel.target);
    }
  });
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  function visit(node) {
    if (visiting.has(node.name)) {
      console.warn(`Circular dependency detected involving ${node.name}, breaking sort.`);
      return;
    }
    if (visited.has(node.name)) {
      return;
    }
    visiting.add(node.name);
    visited.add(node.name);
    node.dependencies.forEach((depName)=>{
      const depNode = nameToNode.get(depName);
      if (depNode) {
        visit(depNode);
      }
    });
    visiting.delete(node.name);
    sorted.push(node.name);
  }
  nodes.forEach((node)=>visit(node));
  return sorted;
})();
const TABLE_PROCESSING_ORDER = sortedTables;
console.log('🏗️ TABLE_PROCESSING_ORDER (dependency sorted):', TABLE_PROCESSING_ORDER);
const filterDataForTable = (data, tableName)=>{
  console.log(`📋 Filtering ${data.length} rows for table: ${tableName}`);
  // Get table info from schema
  const table = SCHEMA_CONFIG.tables.find((t)=>t.name === tableName);
  if (!table) {
    console.warn(`⚠️  Table ${tableName} not found in schema`);
    return [];
  }
  // Check if this is a lookup table (has only id, name, created_at, updated_at columns)
  const isLookupTable = table.columns && table.columns.filter((col)=>![
      'id',
      'created_at',
      'updated_at'
    ].includes(col.name)).length === 1 && table.columns.some((col)=>col.name === 'name');
  if (isLookupTable) {
    console.log(`🏷️  ${tableName}: Detected as lookup table`);
    // For lookup tables, extract unique values from CSV columns that might map to 'name'
    const uniqueValues = new Set();
    data.forEach((row)=>{
      Object.keys(row).forEach((key)=>{
        const value = row[key];
        if (value && typeof value === 'string') {
          const cleanValue = value.trim();
          // Add any non-empty string values that could be lookup values
          if (cleanValue && cleanValue !== '' && cleanValue.length < 100) {
            uniqueValues.add(cleanValue);
          }
        }
      });
    });
    // Convert to array of objects with 'name' field
    const filteredData = Array.from(uniqueValues).map((value)=>({
        name: value
      }));
    console.log(`✅ ${tableName}: ${filteredData.length} unique values extracted for lookup table`);
    return filteredData;
  } else {
    console.log(`📊 ${tableName}: Detected as data table`);
    // For data tables, pass through all data
    const filteredData = data.filter((row)=>row && typeof row === 'object');
    console.log(`✅ ${tableName}: ${filteredData.length} rows passed filtering`);
    return filteredData;
  }
};
// Schema-aware mapping - get table schema info
const getTableSchema = (tableName)=>{
  const schemaConfig = SCHEMA_CONFIG.tables || [];
  return schemaConfig.find((t)=>t === tableName) ? {} : {}; // Simple version doesn't have detailed schema
};
// Get table schema from the passed schema configuration
const getTableColumns = (tableName)=>{
  // This will be replaced with actual schema data when the function is generated
  const schemaData = SCHEMA_CONFIG.tables || [];
  const table = schemaData.find((t)=>t.name === tableName);
  if (!table || !table.columns) {
    console.warn(`⚠️  No schema found for table ${tableName}, allowing all columns`);
    return []; // Return empty array to allow all columns
  }
  // Return column names, excluding system columns that we generate
  return table.columns.map((col)=>col.name).filter((name)=>![
      'id',
      'created_at',
      'updated_at'
    ].includes(name));
};
// DYNAMIC FUZZY COLUMN MATCHING - Works with ANY schema without hardcoding
const calculateStringSimilarity = (str1, str2)=>{
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};
const levenshteinDistance = (str1, str2)=>{
  const matrix = [];
  for(let i = 0; i <= str2.length; i++){
    matrix[i] = [
      i
    ];
  }
  for(let j = 0; j <= str1.length; j++){
    matrix[0][j] = j;
  }
  for(let i = 1; i <= str2.length; i++){
    for(let j = 1; j <= str1.length; j++){
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[str2.length][str1.length];
};
const normalizeColumnName = (name)=>{
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
};
const findBestColumnMatch = (csvHeader, allowedColumns)=>{
  if (allowedColumns.length === 0) {
    return normalizeColumnName(csvHeader);
  }
  const normalizedCsvHeader = normalizeColumnName(csvHeader);
  // 1. Exact match
  if (allowedColumns.includes(normalizedCsvHeader)) {
    return normalizedCsvHeader;
  }
  // 2. Find best fuzzy match
  let bestMatch = null;
  let bestScore = 0;
  const SIMILARITY_THRESHOLD = 0.6; // 60% similarity required
  allowedColumns.forEach((dbColumn)=>{
    // Use a simpler, more reliable direct similarity score
    const score = calculateStringSimilarity(normalizedCsvHeader, dbColumn);
    if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestMatch = dbColumn;
    }
  });
  return bestMatch;
};
const mapCSVToTableColumns = (csvRow, tableName)=>{
  console.log(`🔄 ${tableName}: Starting dynamic fuzzy column matching...`);
  const mapped = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  // Get allowed columns from schema
  const allowedColumns = getTableColumns(tableName);
  console.log(`📋 ${tableName}: Target columns (${allowedColumns.length}): ${allowedColumns.join(', ')}`);
  const mappedFields = [];
  const skippedFields = [];
  Object.keys(csvRow).forEach((csvKey)=>{
    const originalValue = csvRow[csvKey];
    // Skip empty values
    if (originalValue === null || originalValue === undefined || originalValue === '') {
      return;
    }
    // Skip system columns
    const normalizedKey = normalizeColumnName(csvKey);
    if ([
      'id',
      'created_at',
      'updated_at'
    ].includes(normalizedKey)) {
      return;
    }
    // Find best matching database column
    const targetColumn = findBestColumnMatch(csvKey, allowedColumns);
    if (targetColumn) {
      mapped[targetColumn] = String(originalValue).trim();
      mappedFields.push(`"${csvKey}" → ${targetColumn}`);
    } else {
      skippedFields.push(csvKey);
    }
  });
  console.log(`🎯 ${tableName}: Dynamic mapping results:`);
  console.log(`   ✅ Mapped (${mappedFields.length}): ${mappedFields.join(', ')}`);
  if (skippedFields.length > 0) {
    console.log(`   ⏭️  Skipped (${skippedFields.length}): ${skippedFields.join(', ')}`);
  }
  console.log(`🔍 ${tableName}: Sample mapped row:`, JSON.stringify(mapped, null, 2));
  return mapped;
};
const convertValue = (value, columnName, columnType)=>{
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  const type = columnType.toLowerCase();
  if (type.includes('int')) {
    const num = parseInt(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('numeric') || type.includes('decimal')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('bool')) {
    return [
      'true',
      '1',
      'yes',
      'y'
    ].includes(str.toLowerCase());
  }
  if (type.includes('timestamp') || type.includes('date')) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  return str;
};
class ForeignKeyResolver {
  constructor(){
    this.cache = new Map();
  }
  async resolveFK(tableName, value) {
    if (!value) return null;
    const cacheKey = `${tableName}:${value}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    // Simple FK resolution - return null for now
    // In a real implementation, this would query the database
    return null;
  }
}
const resolveForeignKeys = async (data, tableName)=>{
  console.log(`🔗 ${tableName}: Starting FK resolution with ${data.length} rows...`);
  const resolver = new ForeignKeyResolver();
  // Simple pass-through - no FK resolution in basic version
  console.log(`✅ ${tableName}: FK resolution complete, returning ${data.length} rows`);
  if (data.length > 0) {
    console.log(`🔍 ${tableName}: Sample resolved row:`, JSON.stringify(data[0], null, 2));
  }
  return data;
};
const validateRowForTable = (row, tableName)=>{
  const errors = [];
  // Very permissive validation - only reject completely empty rows
  if (!row || typeof row !== 'object') {
    errors.push('Row is not a valid object');
    return {
      isValid: false,
      errors
    };
  }
  // Check if row has any actual data
  // NOTE: Don't check for 'id' here since it's generated during mapping, not before validation
  const dataKeys = Object.keys(row).filter((key)=>key && row[key] !== null && row[key] !== undefined && row[key] !== '');
  if (dataKeys.length === 0) {
    errors.push('Row contains no data fields');
    return {
      isValid: false,
      errors
    };
  }
  // Row is valid if it has any non-empty data
  return {
    isValid: true,
    errors: []
  };
};
const validateBatch = (batch, tableName)=>{
  const validRows = [];
  const invalidRows = [];
  batch.forEach((row, index)=>{
    const validation = validateRowForTable(row, tableName);
    if (validation.isValid) {
      validRows.push(row);
    } else {
      invalidRows.push({
        row,
        errors: validation.errors,
        index
      });
      console.error(`❌ Validation failed for ${tableName} row (index: ${index}): ${validation.errors.join(', ')}`);
    }
  });
  console.log(`📊 ${tableName} validation: ${validRows.length} valid, ${invalidRows.length} invalid`);
  if (validRows.length > 0) {
    console.log(`🔍 ${tableName} sample valid row:`, JSON.stringify(validRows[0], null, 2));
  }
  return {
    validRows,
    invalidRows
  };
};
// Export all functions for the edge function template
export { TABLE_PROCESSING_ORDER, filterDataForTable, mapCSVToTableColumns, resolveForeignKeys, validateBatch, SCHEMA_CONFIG };
class DynamicCSVProcessor {
  supabaseClient;
  request;
  progress;
  errors = [];
  warnings = [];
  startTime;
  serviceKey;
  // Processing constants from schema config - use fallback if SCHEMA_CONFIG not available
  static CHUNK_SIZE = (typeof SCHEMA_CONFIG !== 'undefined' ? SCHEMA_CONFIG.batchSize : null) || 100;
  static MAX_CPU_TIME = (typeof SCHEMA_CONFIG !== 'undefined' ? SCHEMA_CONFIG.timeoutMs : null) || 1400;
  // Dynamic caches for FK resolution
  fkResolver;
  processedRowsCache = new Map();
  constructor(request, supabaseUrl, supabaseKey){
    this.request = request;
    this.startTime = Date.now();
    this.serviceKey = supabaseKey;
    // Safely instantiate FK resolver if available
    try {
      this.fkResolver = typeof ForeignKeyResolver !== 'undefined' ? new ForeignKeyResolver() : null;
    } catch (error) {
      console.log('⚠️ ForeignKeyResolver not available, using fallback');
      this.fkResolver = null;
    }
    // CRITICAL: Ensure service role key authentication
    console.log('🔧 Creating Supabase client...');
    console.log('🔧 URL:', supabaseUrl);
    console.log('🔧 Key length:', supabaseKey?.length || 0);
    console.log('🔧 Key starts with:', supabaseKey?.substring(0, 15) || 'NO KEY');
    this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    });
    console.log('✅ Supabase client created with service role key');
    // Test database connectivity and permissions
    this.testDatabaseAccess().catch((error)=>{
      console.log('❌ Database access test failed:', error.message);
    });
    this.progress = {
      jobId: request.jobId,
      status: "processing",
      overallProgress: 0,
      currentPhase: "parsing",
      processedRows: request.processedRows || 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
      lastUpdate: new Date(),
      needsContinuation: false,
      continuationData: undefined
    };
  }
  async processCSVChunk(onProgress) {
    try {
      console.log('🚀 DYNAMIC SEEDING ENGINE - Starting processing');
      if (onProgress) {
        return await this.processOneChunkWithContinuation(onProgress);
      } else {
        return await this.processSingleChunk();
      }
    } catch (error) {
      console.error('Processing error:', error);
      this.progress.status = "failed";
      this.errors.push({
        message: error.message,
        timestamp: new Date()
      });
      this.progress.errors = this.errors;
      throw error;
    }
  }
  async processOneChunkWithContinuation(onProgress) {
    console.log('📋 DYNAMIC CHUNK MODE: Processing one chunk per invocation');
    // Get CSV data
    this.updateProgress(10, "parsing", "Downloading CSV...");
    onProgress(this.progress);
    const csvContent = await this.getCSVContentFromStorage();
    const lines = csvContent.split('\n').filter((line)=>line.trim());
    if (lines.length <= 1) {
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.updateProgress(100, "completing", "No data to process");
      onProgress(this.progress);
      return this.progress;
    }
    // Parse headers
    this.updateProgress(15, "parsing", "Parsing CSV structure...");
    onProgress(this.progress);
    const headers = lines[0].split(',').map((h)=>h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);
    const totalRows = dataLines.length;
    console.log(`📊 Total rows to process: ${totalRows}`);
    // Process chunk using dynamic table processing order
    const processedRows = this.request.processedRows || 0;
    const chunkSize = DynamicCSVProcessor.CHUNK_SIZE;
    const startIdx = processedRows;
    const endIdx = Math.min(startIdx + chunkSize, totalRows);
    if (startIdx >= totalRows) {
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.updateProgress(100, "completing", "All data processed");
      onProgress(this.progress);
      return this.progress;
    }
    const chunkLines = dataLines.slice(startIdx, endIdx);
    let newProcessedRows = processedRows;
    if (chunkLines.length > 0) {
      // Parse chunk data
      const chunkData = chunkLines.map((line)=>{
        const values = line.split(',').map((v)=>v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index)=>{
          row[header] = values[index] || '';
        });
        return row;
      });
      console.log(`📦 Processing chunk: rows ${startIdx + 1}-${endIdx} of ${totalRows}`);
      const progressPercent = Math.min(95, 25 + (startIdx + chunkLines.length) / totalRows * 70);
      this.updateProgress(progressPercent, "processing", `Processing rows ${startIdx + 1}-${endIdx} of ${totalRows} (${Math.round(progressPercent)}%)`);
      onProgress(this.progress);
      // Process chunk data with timeout protection using dynamic logic
      await this.processChunkDataWithDynamicLogic(chunkData);
      newProcessedRows = processedRows + chunkLines.length;
      this.progress.processedRows = newProcessedRows;
      this.progress.successfulRows = Math.max(this.progress.successfulRows, newProcessedRows);
      console.log(`✅ Completed chunk, total processed: ${newProcessedRows}/${totalRows}`);
    }
    // Check if we need continuation
    if (newProcessedRows < totalRows) {
      console.log(`🔄 Need continuation: ${newProcessedRows}/${totalRows} completed`);
      this.progress.status = "processing";
      this.progress.needsContinuation = true;
      this.progress.continuationData = {
        processedRows: newProcessedRows,
        totalRows: totalRows,
        nextChunkIndex: Math.ceil(newProcessedRows / chunkSize)
      };
      const continuationPercent = Math.min(95, newProcessedRows / totalRows * 95);
      this.updateProgress(continuationPercent, "processing", `Chunk complete: ${newProcessedRows}/${totalRows} rows (${Math.round(continuationPercent)}%)`);
      onProgress(this.progress);
      // Schedule next chunk
      this.scheduleNextChunk(newProcessedRows, totalRows, chunkSize);
      return this.progress;
    }
    // All done
    console.log(`🎉 ALL DATA PROCESSED: ${newProcessedRows}/${totalRows} rows`);
    this.progress.status = "completed";
    this.progress.overallProgress = 100;
    this.progress.needsContinuation = false;
    this.updateProgress(100, "completing", "Data seeding completed successfully");
    onProgress(this.progress);
    return this.progress;
  }
  async processChunkDataWithDynamicLogic(chunkData) {
    if (!chunkData || chunkData.length === 0) return;
    const startTime = Date.now();
    // Safely get table processing order with fallback
    const tableOrder = typeof TABLE_PROCESSING_ORDER !== 'undefined' ? TABLE_PROCESSING_ORDER : [
      'properties',
      'users',
      'categories'
    ];
    console.log(`🚀 Processing ${tableOrder.length} tables in order: ${tableOrder.join(' → ')}`);
    // Process each table using the AI-generated order
    for (const tableName of tableOrder){
      // Check CPU time before processing each table
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > DynamicCSVProcessor.MAX_CPU_TIME) {
        console.log(`⏰ CPU timeout reached (${elapsedTime}ms), stopping table processing`);
        break;
      }
      console.log(`📋 Processing table: ${tableName} (CPU time: ${elapsedTime}ms)`);
      try {
        // Use AI-generated filtering logic
        const relevantData = filterDataForTable(chunkData, tableName);
        if (relevantData.length === 0) {
          console.log(`⏭️ No data for ${tableName}, skipping`);
          continue;
        }
        console.log(`📊 ${tableName}: ${relevantData.length} rows to process`);
        // Apply AI-generated validation
        const { validRows, invalidRows } = validateBatch(relevantData, tableName);
        if (invalidRows.length > 0) {
          console.log(`⚠️ ${tableName}: ${invalidRows.length} invalid rows found`);
          this.warnings.push(...invalidRows);
        }
        if (validRows.length === 0) {
          console.log(`⏭️ No valid rows for ${tableName}, skipping`);
          continue;
        }
        // Map data using AI-generated column mappers
        const mappedData = validRows.map((row)=>mapCSVToTableColumns(row, tableName));
        // Resolve foreign keys using AI-generated resolvers
        const resolvedData = await resolveForeignKeys(mappedData, tableName, this.supabaseClient);
        // Insert the data
        console.log(`💾 Inserting ${resolvedData.length} rows into ${tableName}`);
        // Log sample data for debugging
        if (resolvedData.length > 0) {
          console.log(`🔍 Sample row for ${tableName}:`, Object.keys(resolvedData[0]).slice(0, 5).join(', '), '...');
        }
        try {
          const { data, error } = await this.supabaseClient.from(tableName).upsert(resolvedData, {
            onConflict: 'id',
            ignoreDuplicates: false
          }).select();
          if (error) {
            console.log(`❌ ${tableName} insert error:`, error.message);
            console.log(`🔍 Error details:`, JSON.stringify(error, null, 2));
            // Check if it's an RLS issue
            if (error.message.includes('owner') || error.message.includes('permission')) {
              console.log(`⚠️  This looks like a Row Level Security (RLS) issue. The table ${tableName} may have RLS enabled without proper policies for the service role.`);
            }
            // Check if it's a column issue
            if (error.message.includes('column') || error.message.includes('schema cache')) {
              console.log(`⚠️  This looks like a column schema issue. The mapped columns may not match the actual table schema.`);
            }
            this.errors.push({
              table: tableName,
              error: error.message,
              timestamp: new Date()
            });
          } else {
            console.log(`✅ ${tableName}: Successfully inserted ${resolvedData.length} rows`);
            if (data) {
              console.log(`📊 ${tableName}: Confirmed ${data.length} rows in database`);
            }
            this.progress.successfulRows += resolvedData.length;
          }
        } catch (e) {
          console.log(`❌ ${tableName} INSERTION CRASH:`, e ? e.message : 'Unknown error');
          console.log(`🔍 Raw error:`, e);
          console.log(`🔍 Data sample that caused crash:`, JSON.stringify(resolvedData.slice(0, 2), null, 2));
          this.errors.push({
            table: tableName,
            error: e ? e.message : 'Unknown insertion crash',
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.log(`❌ Error processing ${tableName}:`, error.message);
      }
    }
  }
  async processSingleChunk() {
    console.log('🔄 CHUNK MODE: Processing chunk', this.request.chunkIndex || 0);
    // Get the chunk of data to process
    const chunkData = await this.getCSVChunk();
    if (!chunkData || chunkData.length === 0) {
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.updateProgress(100, "completing", "Seeding completed successfully");
      return this.progress;
    }
    this.updateProgress(10, "processing", `Processing chunk ${(this.request.chunkIndex || 0) + 1}`);
    // Process this chunk using dynamic logic
    await this.processChunkDataWithDynamicLogic(chunkData);
    // Update progress
    const totalRows = await this.getTotalRowCount();
    this.progress.processedRows += chunkData.length;
    const progressPercent = Math.min(95, this.progress.processedRows / totalRows * 100);
    this.updateProgress(progressPercent, "processing", `Processed ${this.progress.processedRows}/${totalRows} rows`);
    // Check if we need to continue or if we're done
    if (this.progress.processedRows < totalRows) {
      this.progress.status = "processing";
      await this.scheduleNextChunk(this.progress.processedRows, totalRows, DynamicCSVProcessor.CHUNK_SIZE);
    } else {
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.updateProgress(100, "completing", "Seeding completed successfully");
    }
    return this.progress;
  }
  async getCSVContentFromStorage() {
    try {
      const filePath = this.request.fileUpload?.storagePath;
      if (!filePath) {
        throw new Error('No file path provided');
      }
      console.log('Downloading CSV from storage:', filePath);
      const { data, error } = await this.supabaseClient.storage.from('csv-uploads').download(filePath);
      if (error) {
        throw new Error(`Storage download failed: ${error.message}`);
      }
      const csvContent = await data.text();
      return csvContent;
    } catch (error) {
      console.error('Error downloading CSV:', error);
      throw error;
    }
  }
  async getCSVChunk() {
    try {
      const chunkIndex = this.request.chunkIndex || 0;
      const startRow = chunkIndex * DynamicCSVProcessor.CHUNK_SIZE;
      const endRow = startRow + DynamicCSVProcessor.CHUNK_SIZE;
      console.log(`Getting CSV chunk: rows ${startRow} to ${endRow}`);
      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\n').filter((line)=>line.trim());
      if (lines.length === 0) {
        return [];
      }
      // Get headers and slice the data for this chunk
      const headers = lines[0].split(',').map((h)=>h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1);
      const chunkLines = dataLines.slice(startRow, endRow);
      if (chunkLines.length === 0) {
        return [];
      }
      // Parse chunk into objects
      const chunkData = chunkLines.map((line)=>{
        const values = line.split(',').map((v)=>v.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((header, index)=>{
          row[header] = values[index] || '';
        });
        return row;
      });
      console.log(`Parsed ${chunkData.length} rows for chunk ${chunkIndex}`);
      return chunkData;
    } catch (error) {
      console.error('Error getting CSV chunk:', error);
      throw new Error(`Failed to get CSV chunk: ${error.message}`);
    }
  }
  async getTotalRowCount() {
    try {
      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\n').filter((line)=>line.trim());
      return Math.max(0, lines.length - 1); // Subtract header
    } catch (error) {
      console.log('Could not get total row count:', error);
      return 1000; // Fallback estimate
    }
  }
  scheduleNextChunk(processedRows, totalRows, chunkSize) {
    const nextChunkIndex = Math.floor(processedRows / chunkSize);
    console.log(`🚀 Scheduling next chunk: ${nextChunkIndex} (rows ${processedRows}/${totalRows})`);
    const nextRequest = {
      fileId: this.request.fileId,
      jobId: this.request.jobId,
      schema: this.request.schema,
      configuration: this.request.configuration,
      fileUpload: this.request.fileUpload,
      projectConfig: this.request.projectConfig,
      processedRows: processedRows
    };
    // Fire-and-forget continuation request
    setTimeout(async ()=>{
      try {
        const projectId = this.request.schema?.projectId || this.request.projectConfig?.projectId;
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/seed-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.serviceKey}`
          },
          body: JSON.stringify(nextRequest)
        });
        console.log(`📤 Next chunk scheduled: ${response.ok ? 'success' : 'failed'}`);
      } catch (error) {
        console.log(`❌ Error scheduling next chunk:`, error.message);
      }
    }, 100);
  }
  async testDatabaseAccess() {
    try {
      console.log('🧪 Testing database access with service role key...');
      const tableOrder = typeof TABLE_PROCESSING_ORDER !== 'undefined' ? TABLE_PROCESSING_ORDER : [];
      if (tableOrder.length === 0) {
        console.log("⚠️ No tables found in TABLE_PROCESSING_ORDER for testing.");
        return;
      }
      const testTable = tableOrder[0];
      console.log(`🧪 Testing select permission on table: ${testTable}`);
      const { error } = await this.supabaseClient.from(testTable).select('id').limit(1);
      if (error) {
        console.log(`❌ Select test failed on ${testTable}:`, error.message);
        if (error.message.includes('permission') || error.message.includes('policy')) {
          console.log(`⚠️  This looks like a Row Level Security (RLS) issue. The table ${testTable} may need RLS disabled or service role policies for the service role to write to it.`);
        } else {
          console.log(`⚠️  CRITICAL: The service role key appears to be invalid or lacks permissions to read from table ${testTable}.`);
        }
      } else {
        console.log(`✅ Select test succeeded on ${testTable}. Service role key has read permissions.`);
      }
    } catch (error) {
      console.log('❌ Database test exception:', error.message);
    }
  }
  updateProgress(percent, phase, message) {
    this.progress.overallProgress = Math.min(100, Math.max(0, percent));
    this.progress.currentPhase = phase;
    this.progress.lastUpdate = new Date();
    this.progress.errors = this.errors;
    this.progress.warnings = this.warnings;
    if (message) {
      console.log('[' + this.progress.jobId + ']', message, '(' + percent.toFixed(1) + '%)');
    }
  }
}
serve(async (req)=>{
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }
  const url = new URL(req.url);
  const isStreaming = url.searchParams.get("stream") === "true";
  if (req.method === "POST") {
    try {
      const request = await req.json();
      if (!request.fileId || !request.jobId || !request.schema) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: fileId, jobId, or schema"
        }), {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      // Get Supabase credentials - MUST use service role key for database writes
      const supabaseUrl = request.supabaseUrl || 'https://' + request.schema.projectId + '.supabase.co' || Deno.env.get("SUPABASE_URL");
      // Try multiple possible sources for the service key
      let supabaseKey = request.supabaseServiceKey || request.projectConfig?.apiKey || request.serviceRoleKey || request.apiKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      console.log('🔍 Service key source check:');
      console.log('- request.supabaseServiceKey:', !!request.supabaseServiceKey);
      console.log('- request.projectConfig?.apiKey:', !!request.projectConfig?.apiKey);
      console.log('- request.serviceRoleKey:', !!request.serviceRoleKey);
      console.log('- request.apiKey:', !!request.apiKey);
      console.log('- ENV variable:', !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      console.log('🔍 Edge Function received credentials:');
      console.log('- URL:', supabaseUrl);
      console.log('- Service Key (truncated):', supabaseKey ? `${supabaseKey.slice(0, 20)}...${supabaseKey.slice(-4)}` : 'NOT PROVIDED');
      console.log('- From request.supabaseServiceKey:', !!request.supabaseServiceKey);
      console.log('- From ENV:', !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      console.log('🔍 Request object keys:', Object.keys(request));
      console.log('🔍 Request supabaseServiceKey type:', typeof request.supabaseServiceKey);
      console.log('🔍 Request supabaseServiceKey value:', request.supabaseServiceKey ? 'HAS VALUE' : 'NULL/UNDEFINED');
      if (!supabaseKey || supabaseKey === "your-service-role-key") {
        throw new Error("Service role key is required for data seeding. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Edge Function environment.");
      }
      console.log('Processing', isStreaming ? 'streaming request' : 'chunk', request.chunkIndex || 0, 'for job', request.jobId);
      const processor = new DynamicCSVProcessor(request, supabaseUrl, supabaseKey);
      if (isStreaming) {
        // Return Server-Sent Events stream for real-time progress updates
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        // Start processing in background with streaming progress
        (async ()=>{
          try {
            // Custom progress handler for streaming
            const progressHandler = (progress)=>{
              const data = JSON.stringify({
                type: "progress",
                data: progress
              });
              writer.write(encoder.encode(`data: ${data}\n\n`));
            };
            // Send initial progress
            progressHandler({
              jobId: request.jobId,
              status: "processing",
              overallProgress: 0,
              currentPhase: "parsing",
              successfulRows: 0,
              failedRows: 0,
              errors: [],
              warnings: [],
              lastUpdate: new Date()
            });
            // Process data with progress callbacks
            const result = await processor.processCSVChunk(progressHandler);
            // Send completion if truly completed
            if (result.status === "completed" && !result.needsContinuation) {
              const completionData = JSON.stringify({
                type: "complete",
                data: {
                  success: true,
                  jobId: request.jobId,
                  statistics: {
                    totalRows: result.successfulRows + result.failedRows,
                    successfulRows: result.successfulRows,
                    failedRows: result.failedRows,
                    errors: result.errors,
                    warnings: result.warnings
                  }
                }
              });
              writer.write(encoder.encode(`data: ${completionData}\n\n`));
              writer.write(encoder.encode(`data: [DONE]\n\n`));
            }
          } catch (error) {
            // Send error message
            const errorData = JSON.stringify({
              type: "error",
              data: {
                success: false,
                error: error.message || "Internal server error"
              }
            });
            writer.write(encoder.encode(`data: ${errorData}\n\n`));
          } finally{
            writer.close();
          }
        })();
        return new Response(readable, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        // Standard JSON response for non-streaming
        const result = await processor.processCSVChunk();
        return new Response(JSON.stringify({
          success: true,
          jobId: request.jobId,
          chunkIndex: request.chunkIndex || 0,
          status: result.status,
          message: result.status === 'completed' ? "Data seeding completed successfully" : "Chunk processed successfully",
          progress: result
        }), {
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
    } catch (error) {
      console.error('Processing error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
  }
  return new Response("Method not allowed", {
    status: 405,
    headers: {
      "Content-Type": "application/json"
    }
  });
});
