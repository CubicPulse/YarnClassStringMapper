public class YarnStringMapper {
    private static final Map<Class<?>, Map<String, String>> a = new HashMap<Class<?>, Map<String, String>>();

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
        Map<String, String> map = a.get(obj.getClass());
        if (map == null) {
            return obj.toString();
        }
        StringBuilder sb = new StringBuilder();
        sb.append(obj.getClass().getSimpleName()).append(" {");
        int fieldCount = 0;
        for (Field field : obj.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers())) {
                continue;
            }
            field.setAccessible(true);
            String name = field.getName();
            String value = map.get(name);
            if (value == null) {
                continue;
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
}