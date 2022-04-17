import 'regenerator-runtime/runtime';
import * as vega from "vega";;
import VegaTransformDB from "vega-transform-db";
import { specRewrite } from "vega-plus"
var htmldiff = require("../dependencies/htmldiff.js")
import { view2dot } from '../dependencies/view2dot'
var hpccWasm = window["@hpcc-js/wasm"];
import { DuckDB } from "../src"
import {tableFromJson, vegaplus_spec, vega_spec} from "./main"
import { sign } from 'crypto';



var ace = require('brace');
require('brace/mode/json');
require('brace/theme/github');

var editor = ace.edit('editor');
editor.getSession().setMode('ace/mode/json');
editor.setTheme('ace/theme/github');

editor.setValue(JSON.stringify(vegaplus_spec, null, 3));

// var vseditor = ace.edit(document.querySelectorAll('pre[id=editor]')[0]);
// vseditor.getSession().setMode('ace/mode/json');
// vseditor.setTheme('ace/theme/github');
// vseditor.setValue(JSON.stringify(vega_spec, null, 3));

var url_loc = window.location.origin.toString();
var db = DuckDBs()
var csv_url = require("../data/flights-3m.csv");
vega_spec["data"][0]["url"] = url_loc + csv_url


async function DuckDBs(){
  var url = require("../data/flights-3m.parquet");
  url = url_loc + url
  const db = new DuckDB<"Test">(url, "flights");
  await db.initialize();
  var cars_url = require("../data/cars.parquet");
  await db.create_table(url_loc+cars_url, "cars")
  return db
}

function rename(dataSpec, type) {
    for (var i = 0; i < dataSpec.length; i++) {
      var spec = dataSpec[i]
      for (const transform of spec.transform) {
        if (transform.type === "dbtransform") transform.type = type
  
      }
    }
  }

db.then(function(db){
    async function duck_db_query(query){
      const results = await db.queries(query);
      return results;
    }

    (VegaTransformDB as any).type('Serverless');
    (VegaTransformDB as any).QueryFunction(duck_db_query);    

    async function Run_Visualization(){
        var sel = (document.getElementById('VegaType') as HTMLInputElement).value;
        var vp_spec = JSON.parse(editor.getValue().toString().trim())
        var table_name = vp_spec["data"][1]['name']

        const newspec_vp = specRewrite(vp_spec)
        rename(newspec_vp.data, "dbtransform");
        (vega as any).transforms["dbtransform"] = VegaTransformDB;
        console.log("Vega Plus Start");  
        const runtime_vp = vega.parse(newspec_vp);
        const view_vp = new vega.View(runtime_vp)
        .logLevel(vega.Info)
        .renderer("svg")
        .initialize(document.querySelector("#Visualization"));
        view_vp.addDataListener('table', function(name, value) {
            console.log(name, value);
            tableFromJson(value, 'showData');
          });          
        await view_vp.runAsync();
        console.log("Vega Plus Done");
        tableFromJson(view_vp["_runtime"]["data"][table_name]["values"]["value"], 'showData')
        var tmp = view_vp["_runtime"]["signals"]
        var signal_data = []
        for (var val of Object.keys(tmp)) {
            if(tmp[val]['value']){
                if(typeof(tmp[val]['value'])=='object'){
                    signal_data.push({"Signal": val, "Value": JSON.stringify(tmp[val]['value'])})
                }
                else{
                    signal_data.push({"Signal": val, "Value": tmp[val]['value'].toString()})
                }
            }
            else{
                signal_data.push({"Signal": val, "Value": "null"})
            }
          }
        tableFromJson(signal_data, 'signalData')
        view_vp.runAfter(view => {
            const dot = `${view2dot(view)}`
            hpccWasm.graphviz.layout(dot, "svg", "dot").then(svg => {
              const placeholder = document.getElementById("graph-placeholder");
              placeholder.innerHTML = svg;
            });
          })
    }

    Run_Visualization()
    document.getElementById('run').addEventListener('click', Run_Visualization);
});
