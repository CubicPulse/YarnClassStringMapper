import { argv, exit, isBun } from "process";
import * as fs from "fs";
import * as path from "path";

if(!isBun) {
  console.log("I'm not a bun");
  exit(1);
}

const mappingsRoot = "yarn/mappings";
const mappingsBasePkg = "net.minecraft.network.packet";

interface FieldMapping {
    obf: string;
    deobf: string;
    obftype: string;
    javatype?: string;
    deobftype?: string;
    typemeta?: any;
    meta?: any;
}

let java_type_mappings = new Map<string, string>();
java_type_mappings.set("I", "int");
java_type_mappings.set("B", "byte");
java_type_mappings.set("S", "short");
java_type_mappings.set("J", "long");
java_type_mappings.set("F", "float");
java_type_mappings.set("D", "double");
java_type_mappings.set("C", "char");
java_type_mappings.set("Z", "boolean");

const version = argv[2];

let java_classes: any;
import * as java from './java';
const classMetaPath = "classes-" + version + ".json";
if(!fs.existsSync(classMetaPath)) {
    // Find the named jar in the yarn directory
    let jarFiles = fs.readdirSync("yarn").filter(file => file.endsWith(".jar")).filter(file => file.includes("named")).filter(file => file.includes(version));
    if(jarFiles.length != 1) {
        console.error("Expected exactly one named jar in the yarn directory, found " + jarFiles.length);
        exit(1);
    }
    let jarPath = "yarn/" + jarFiles[0];
    java_classes = await java.loadClasses(jarPath);
    console.log(java_classes);
    fs.writeFileSync(classMetaPath, JSON.stringify(java_classes, null, 2));
} else {
    java_classes = JSON.parse(fs.readFileSync(classMetaPath, "utf-8"));
}


let class_mappings = new Map<string, string>();
let class_fields = new Map<string, Map<string, FieldMapping>>();

// Find all .mapping files in the mappings directory and all subdirectories
function findMappings(dir: string) {
  let files = fs.readdirSync(dir);
  for (let file of files) {
    let filePath = path.join(dir, file);
    let stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findMappings(filePath);
    } else {
      if (filePath.endsWith(".mapping")) {
        let mappings = fs.readFileSync(filePath, "utf-8").split("\n");
        parseMappings(mappings);
      }
    }
  }
}


function parseMappings(mappings: string[]) {
    let contextStack = [];
    let prettyContextStack = [];
    let tabCount = 0;
    let prevObfName = "";
    let prevPrettyName = "";
    for (let line of mappings) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith("#")) continue;

        const parts = trimmed.split(" ");
        const type = parts[0];
        const args = parts.slice(1);

        // Compute the tab count
        let i = 0;
        while (line[i] === "\t") {
            i++;
        }
        if(i > tabCount) {
            contextStack.push(prevObfName);
            prettyContextStack.push(prevPrettyName);
        }
        while(i < tabCount) {
            contextStack.pop();
            prettyContextStack.pop();
            tabCount--;
        }

        tabCount = i;
        
        const fullContext = contextStack.join("$");
        
        if (type === "CLASS") {
            const class_context = [...contextStack, args[0]].join("$");
            const pretty_field_index = args.length - 1;
            const pretty_class_context = [...prettyContextStack, args[pretty_field_index]].join("$");
            class_mappings.set(class_context, pretty_class_context);
            class_fields.set(class_context, new Map());
            java_type_mappings.set("L" + args[0] + ";", args[0]);
            prevObfName = args[0];
            prevPrettyName = args[pretty_field_index];
        }
        if (type === "FIELD") {
            class_fields.get(fullContext)!.set(args[0], {
                deobf: args[1],
                obf: args[0],
                obftype: args[2]
            });
        }
        // Ignore other types (ARG, METHOD, etc.)
    }
}

findMappings(mappingsRoot);

// Remap all fields to their deobfuscated names
class_fields.forEach((fields, context) => {
    const className = class_mappings.get(context);
    let newFields = new Map<string, FieldMapping>();
    fields.forEach((field, name) => {
        field.javatype = java_type_mappings.get(field.obftype) || field.obftype;
        if(field.javatype?.startsWith("L")) {
            // Remove the L and ; from the type
            field.javatype = field.javatype.substring(1, field.javatype.length - 1);
        }
        field.deobftype = class_mappings.get(field.javatype) || field.javatype;
        if(field.deobftype && className) {
            field.typemeta = java_classes[className?.replaceAll("/", ".").replaceAll("$", ".")];
            field.meta = field.typemeta?.fields?.find((f: any) => f.name === field.deobf);
        }
        newFields.set(name, field);
    });
    class_fields.set(context, newFields);
});

// Cull all private classes and static fields
class_fields.forEach((fields, context) => {
    const className = class_mappings.get(context);
    let newFields = new Map<string, FieldMapping>();
    fields.forEach((field, name) => {
        // If the type was not found, ignore it
        if(!field.typemeta) {
            console.log("Type not found for " + className);
            return;
        }
        const ignoreType = !field.typemeta?.scope?.includes("public");
        // const isTypeEnum = (<string[]>(field.typemeta?.extends)?.filter((e: string) => e.startsWith("java.lang.Enum"))).length > 0;
        // if(isTypeEnum) {
        //     console.log("Force including enum type", field.typemeta, field);
        // }
        // const ignoreField = !isTypeEnum && field.meta?.describe?.includes("static");
        const ignoreField = field.meta?.describe?.includes("static");
        if(ignoreField || ignoreType) {
            console.log("Ignoring " + field.deobf + " in " + field.deobftype);
            return;
        }
        newFields.set(name, field);
    });
    class_fields.set(context, newFields);
});

function printMappings() {
  let correct_mappings: any = {};
    for (let [context, className] of class_mappings) {
        let fields = class_fields.get(context);
        let correct_fields: any = {};
        for (let [field, obfField] of fields!) {
            correct_fields[field] = obfField;
        }
        correct_mappings[className] = correct_fields;
    }
    console.log(correct_mappings);
}

// printMappings();

// "net.minecraft.network.packet.c2s.play.ClientStatusC2SPacket": { "field_1233": "status" }
function buildPrints() {
    let correct_mappings: any = {};
    for (let [context, className] of class_mappings) {
        let fields = class_fields.get(context);
        if(className === "net.minecraft.resource.ResourcePackCompatibility") {
            console.log("Found ResourcePackCompatibility");
            console.log(fields);
        }
        let correct_fields: any = {};
        for (let [field, obfField] of fields!) {
            correct_fields[obfField.obf] = obfField.deobf;
        }
        correct_mappings[className.replaceAll("/", ".")] = correct_fields;
    }
    fs.writeFileSync("mappings.json", JSON.stringify(correct_mappings, null, 2));

    return correct_mappings;
}

let corrected = buildPrints();

// a.put(net.minecraft.network.packet.c2s.play.ClientStatusC2SPacket.class, Map.of("field_1233", "status"));

function buildJavaStringPrints() {
    let lines = [];
    const invalidRegex = /.+\$\d+$/;
    const ignoreRegex = /packageinfo|package-info|package-info.class/;
    let imports = new Set<string>();
    for (let [className, fields] of Object.entries(corrected)) {
        let fieldLines = [];
        let fieldMap = fields as any;
        for (let [obf, deobf] of Object.entries(fieldMap)) {
            fieldLines.push(`"field_${obf}", "${deobf}"`);
        }
        // Check if the class exists
        const fullJavaName = className.replaceAll("/", ".").replaceAll("$", ".");
        if(invalidRegex.test(className.replaceAll("/", "."))) {
            // console.log("Skipping invalid class: " + className.replaceAll("/", "."));
            continue;
        }
        if(ignoreRegex.test(className.replaceAll("/", "."))) {
            // console.log("Skipping ignored class: " + className.replaceAll("/", "."));
            continue;
        }
        if(!java_classes[className.replaceAll("/", ".")]) {
            // console.log("Class not found: " + className.replaceAll("/", "."));
            continue;
        }
        // if(fieldLines.length === 0) continue;
        // Find the package of the class
        const pkg = className.split(".").slice(0, -1).join(".");
        // imports.add(pkg + ".*");
        const classType = className.split(".").pop();
        const classJavaType = `${fullJavaName}.class`;

        lines.push(`a.put(${classJavaType}, new YarnStringMapperEntry("${classType}", Map.of(${fieldLines.join(", ")})));`);
    }

    let template = fs.readFileSync("YarnStringMapper.template.java", "utf-8");
    let importLines = Array.from(imports).map(i => `import ${i};`).join("\n");
    for (let indent = 0; indent < 32; indent++) {
        for (let i = 0; i < lines.length; i++) {
            lines[i] = " " + lines[i];
        }
        template = template.replace("//#{yarnmappings:imports}", importLines);
        template = template.replace("//#{yarnmappings:indent=" + indent + "}", lines.join("\n"));
    }

    fs.writeFileSync("YarnStringMapper.java", template);
    return lines;
}

buildJavaStringPrints();

