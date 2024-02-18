package com.cubicpulse.yarn;
//#{yarnmappings:imports}

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.HashMap;
import java.util.Map;


public class YarnStringMapper {
    private static final Map<Class<?>, YarnStringMapperEntry> a = new HashMap<Class<?>, YarnStringMapperEntry>();

    static {
//#{yarnmappings:indent=8}
    }

    public static String toString(Object obj) {
        return toString(obj, "");
    }

    public static String toString(Object obj, String indent) {
        if (obj == null) {
            return null;
        }
        if(obj instanceof String) {
            return "\"" + obj + "\"";
        }
        if(obj instanceof List) {
            return createStringForList((List<?>) obj, indent);
        }
        if(obj instanceof Map) {
            return createStringForMap((Map<?, ?>) obj, indent);
        }
        if(obj instanceof Object[]) {
            return createStringForList(Arrays.asList((Object[]) obj), indent);
        }
        if(obj.getClass().isEnum()) {
            return obj.getClass().getSimpleName() + "." + obj;
        }
        YarnStringMapperEntry entry = a.get(obj.getClass());
        if (entry == null) {
            return obj.toString();
        }
        var map = entry.map();
        StringBuilder sb = new StringBuilder();
        sb.append(entry.className()).append(" {");
        int fieldCount = 0;
        for (Field field : obj.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers())) {
                continue;
            }
            field.setAccessible(true);
            String name = field.getName();
            String value = map.get(name);
            if (value == null) {
                value = name;
            }
            if (fieldCount == 0) {
                sb.append("\n");
            }
            try {
                sb.append(indent).append(value).append(" = ").append(toString(field.get(obj), indent + "  ")).append("\n");
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
            fieldCount++;
        }
        if(fieldCount > 0)
            sb.append(indent);
        sb.append("}");
        return sb.toString();
    }

    private static String createStringForList(List<?> list, String indent) {
        StringBuilder sb = new StringBuilder();
        sb.append("[\n");
        for (Object obj : list) {
            sb.append(indent).append("  ").append(toString(obj, indent + "  ")).append("\n");
        }
        sb.append(indent).append("]");
        return sb.toString();
    }

    private static String createStringForMap(Map<?, ?> map, String indent) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            sb.append(indent).append("  ").append(toString(entry.getKey(), indent + "  ")).append(" = ").append(toString(entry.getValue(), indent + "  ")).append("\n");
        }
        sb.append(indent).append("}");
        return sb.toString();
    }

    public record YarnStringMapperEntry(String className, Map<String, String> map) {
    }
}