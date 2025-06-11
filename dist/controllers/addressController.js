import { z } from "zod";
import prisma from "../config/prisma";
import { geocodeAddress } from "../utils/googleMapApi";
import axios from "axios";
const createAddressSchema = z.object({
    province: z.string().min(1, "Province is required"),
    district: z.string().min(1, "District is required"),
    ward: z.string().min(1, "Ward is required"),
    street: z.string().min(1, "Street is required"),
});
// Query parameters validation schema
const queryParamsSchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).default("10"),
    sort_by: z
        .enum(["province", "district", "ward", "street", "create_at", "update_at"])
        .default("create_at"),
    sort_order: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().optional(),
});
// Location API endpoints
const LOCATION_API_BASE = "https://provinces.open-api.vn/api";
// Common headers for location API requests
const LOCATION_API_HEADERS = {
    Connection: "keep-alive",
    "Content-Type": "application/json",
    Accept: "application/json",
};
export const AddressController = {
    get: async (req, res) => {
        try {
            const validatedQuery = queryParamsSchema.parse(req.query);
            const { page, limit, sort_by, sort_order, search } = validatedQuery;
            const skip = (page - 1) * limit;
            const where = {
                deleted_at: null,
                OR: search
                    ? [
                        { province: { contains: search, mode: "insensitive" } },
                        { district: { contains: search, mode: "insensitive" } },
                        { ward: { contains: search, mode: "insensitive" } },
                        { street: { contains: search, mode: "insensitive" } },
                    ]
                    : undefined,
            };
            const [addresses, total] = await Promise.all([
                prisma.address.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: {
                        [sort_by]: sort_order,
                    },
                }),
                prisma.address.count({ where }),
            ]);
            const totalPages = Math.ceil(total / limit);
            return res.status(200).json({
                data: addresses,
                total,
                page,
                limit,
                totalPages: totalPages || 1,
            });
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: error.errors.map((err) => ({
                        field: err.path.join("."),
                        message: err.message,
                    })),
                });
            }
            return res.status(500).json({
                error: "Internal server error",
            });
        }
    },
    create: async (req, res) => {
        try {
            const parsedData = createAddressSchema.parse(req.body);
            const fullAddress = `${parsedData.street}, ${parsedData.ward}, ${parsedData.district}, ${parsedData.province}`;
            const coords = await geocodeAddress(fullAddress);
            // Check if coordinates were found
            if (!coords || !coords.lat || !coords.lng) {
                return res.status(400).json({
                    error: "Không thể xác định tọa độ cho địa chỉ này. Vui lòng kiểm tra lại thông tin địa chỉ.",
                });
            }
            const newAddress = await prisma.address.create({
                data: {
                    province: parsedData.province,
                    district: parsedData.district,
                    ward: parsedData.ward,
                    street: parsedData.street,
                    latitude: coords.lat,
                    longitude: coords.lng,
                },
            });
            res.json(newAddress);
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ errors: error.errors });
            }
            res.status(500).json({ error });
        }
    },
    // GET /address/provinces
    getProvinces: async (req, res) => {
        try {
            const response = await axios.get(`${LOCATION_API_BASE}/p`, {
                headers: LOCATION_API_HEADERS,
                responseType: "json",
            });
            return res.status(200).json(response.data);
        }
        catch (error) {
            console.error("Error fetching provinces:", error);
            return res.status(500).json({ error: "Failed to fetch provinces" });
        }
    },
    // GET /address/provinces/:code/districts
    getDistricts: async (req, res) => {
        try {
            const { code } = req.params;
            const response = await axios.get(`${LOCATION_API_BASE}/p/${code}?depth=2`, {
                headers: LOCATION_API_HEADERS,
                responseType: "json",
            });
            return res.status(200).json(response.data.districts || []);
        }
        catch (error) {
            console.error("Error fetching districts:", error);
            return res.status(500).json({ error: "Failed to fetch districts" });
        }
    },
    // GET /address/districts/:code/wards
    getWards: async (req, res) => {
        try {
            const { code } = req.params;
            const response = await axios.get(`${LOCATION_API_BASE}/d/${code}?depth=2`, {
                headers: LOCATION_API_HEADERS,
                responseType: "json",
            });
            return res.status(200).json(response.data.wards || []);
        }
        catch (error) {
            console.error("Error fetching wards:", error);
            return res.status(500).json({ error: "Failed to fetch wards" });
        }
    },
    getById: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid ID format" });
            }
            const address = await prisma.address.findUnique({
                where: { id },
            });
            if (!address) {
                return res.status(404).json({ error: "Address not found" });
            }
            return res.status(200).json(address);
        }
        catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    },
    update: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid ID format" });
            }
            const parsedData = createAddressSchema.parse(req.body);
            // Check if address exists
            const existingAddress = await prisma.address.findUnique({
                where: { id },
            });
            if (!existingAddress) {
                return res.status(404).json({ error: "Address not found" });
            }
            const fullAddress = `${parsedData.street}, ${parsedData.ward}, ${parsedData.district}, ${parsedData.province}`;
            const coords = await geocodeAddress(fullAddress);
            // Check if coordinates were found
            if (!coords || !coords.lat || !coords.lng) {
                return res.status(400).json({
                    error: "Không thể xác định tọa độ cho địa chỉ này. Vui lòng kiểm tra lại thông tin địa chỉ.",
                });
            }
            const updatedAddress = await prisma.address.update({
                where: { id },
                data: {
                    province: parsedData.province,
                    district: parsedData.district,
                    ward: parsedData.ward,
                    street: parsedData.street,
                    latitude: coords.lat,
                    longitude: coords.lng,
                },
            });
            return res.status(200).json(updatedAddress);
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ errors: error.errors });
            }
            return res.status(500).json({ error: "Internal server error" });
        }
    },
    delete: async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid ID format" });
            }
            // Check if address exists
            const existingAddress = await prisma.address.findUnique({
                where: { id },
            });
            if (!existingAddress) {
                return res.status(404).json({ error: "Address not found" });
            }
            // Soft delete by setting deleted_at
            await prisma.address.update({
                where: { id },
                data: { deleted_at: new Date() },
            });
            return res.status(200).json({ message: "Address deleted successfully" });
        }
        catch (error) {
            return res.status(500).json({ error: "Internal server error" });
        }
    },
};
