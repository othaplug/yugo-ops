"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Trash2 } from "lucide-react"
import { useState } from "react"

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/animated-table-rows"

const productsData = [
  {
    id: "PROD001",
    name: "Wireless Mouse",
    category: "Electronics",
    price: "$29.99",
    stock: 150,
  },
  {
    id: "PROD002",
    name: "Mechanical Keyboard",
    category: "Electronics",
    price: "$89.99",
    stock: 75,
  },
  {
    id: "PROD003",
    name: "Noise-Cancelling Headphones",
    category: "Audio",
    price: "$199.99",
    stock: 45,
  },
  {
    id: "PROD004",
    name: "Ergonomic Chair",
    category: "Furniture",
    price: "$249.99",
    stock: 30,
  },
  {
    id: "PROD005",
    name: "Standing Desk",
    category: "Furniture",
    price: "$399.99",
    stock: 20,
  },
]

const TableRowDeleteDemo = () => {
  const [products, setProducts] = useState(productsData)
  const shouldReduceMotion = useReducedMotion()

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0)

  const handleDelete = (id: string) => {
    setProducts((prev) => prev.filter((product) => product.id !== id))
  }

  const rowInitial = shouldReduceMotion
    ? { opacity: 0 }
    : { opacity: 0, x: -20 }
  const rowAnimate = shouldReduceMotion
    ? { opacity: 1 }
    : { opacity: 1, x: 0 }
  const rowExit = shouldReduceMotion
    ? { opacity: 0 }
    : { opacity: 0, x: -100 }

  return (
    <div className="w-full px-10">
      <Table>
        <TableCaption>A list of products in inventory.</TableCaption>

        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="w-[60px] text-center">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <AnimatePresence>
            {products.map((product, index) => (
              <motion.tr
                key={product.id}
                animate={rowAnimate}
                className="hover:bg-muted/50 border-b transition-colors"
                exit={rowExit}
                initial={rowInitial}
                layout={!shouldReduceMotion}
                transition={{
                  duration: shouldReduceMotion ? 0.12 : 0.4,
                  delay: shouldReduceMotion ? 0 : index * 0.1,
                }}
              >
                <TableCell className="font-medium">{product.id}</TableCell>
                <TableCell>{product.name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell className="text-right">{product.price}</TableCell>
                <TableCell className="text-right">{product.stock}</TableCell>
                <TableCell className="text-center">
                  <button
                    aria-label={`Delete ${product.name}`}
                    className="text-[var(--yu3-danger)] hover:bg-[var(--yu3-danger-tint)] rounded p-1"
                    onClick={() => {
                      handleDelete(product.id)
                    }}
                    type="button"
                  >
                    <Trash2 aria-hidden className="h-[18px] w-[18px]" />
                  </button>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={5}>Total Stock</TableCell>
            <TableCell className="text-right">{totalStock}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}

export default TableRowDeleteDemo
